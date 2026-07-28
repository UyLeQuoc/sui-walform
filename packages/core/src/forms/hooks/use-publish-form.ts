'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { sealEncryptSchema, useSealClient } from '../../crypto';
import { useActivePackageId, useOriginalPackageId } from '../../sui/package-id';
import { extractPublishIds } from '../../sui/tx/extract-form-ids';
import { buildCreateTreasuryTx } from '../../sui/tx/create-treasury';
import { buildRecordFreeCloneTx } from '../../sui/tx/purchase-template-only';
import { buildUpdateSchemaTx } from '../../sui/tx/update-schema';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import { useWalrusWalletUpload } from '../../walrus';
import { buildPublishTx } from '../lib/build-publish-tx';
import { uploadCoverImageIfNeeded } from '../lib/upload-cover-on-publish';
import type { PublishOptions } from '../components/publish/PublishDialog';
import { formDb } from '../services/form-db';
import { usePublishStore } from '../store/publish-store';
import { useTxSteps, type UseTxStepsResult } from './use-tx-steps';

export interface UsePublishFormInput {
  formId: string;
}

export interface PublishedFormRefs {
  /** Shared Form object id — feeds /forms/results?formId=…. */
  formObjectId: string;
  /** Owned FormOwnerCap id minted by the publish PTB. */
  formOwnerCapId: string;
  /** 'on-chain' for live forms, 'template' for marketplace listings. */
  mode: 'on-chain' | 'template';
}

export interface UsePublishFormResult {
  isSubmitting: boolean;
  /** Returns the new on-chain refs on success, or null on failure / cancel. */
  publish: (options: PublishOptions) => Promise<PublishedFormRefs | null>;
  /** True iff the active network has a deployed walform package. */
  isReady: boolean;
  /** Step indicator state — render via `<TxSteps steps={steps.steps} />`. */
  steps: UseTxStepsResult;
}

/**
 * End-to-end publish orchestration. Owns:
 *   1. Walrus cover-image upload (rewrites schema before tx).
 *   2. Main publish PTB (on-chain or marketplace).
 *   3. Sealed-schema follow-up (private + flag enabled).
 *   4. Treasury follow-up (paid forms).
 *   5. IDB cleanup + dApp Kit query invalidation + success toast.
 *
 * Failure semantics: tier-1 (cover upload) failure aborts the whole publish.
 * Tier-2 (main tx) failure aborts. Tier-3 (sealed schema or treasury follow-up)
 * failures only toast — the main form already exists on-chain and the user
 * can retry the follow-up later.
 */
export function usePublishForm({ formId }: UsePublishFormInput): UsePublishFormResult {
  const packageId = useActivePackageId();
  const originalPackageId = useOriginalPackageId();
  const suiClient = useSuiGrpcClient();
  const seal = useSealClient();
  const { execute, sender } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const setPublishState = usePublishStore((s) => s.setPublishState);
  const { uploadBlob } = useWalrusWalletUpload();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const steps = useTxSteps();

  const publish = useCallback(
    async (options: PublishOptions): Promise<PublishedFormRefs | null> => {
      if (!sender || !packageId) {
        toast.error('Connect a wallet on a network with a deployed walform package.');
        return null;
      }
      setIsSubmitting(true);
      setPublishState(formId, 'publishing');

      // Compose the step list based on what this publish actually needs.
      const stored = await formDb.getById(formId);
      if (!stored) {
        setIsSubmitting(false);
        setPublishState(formId, 'error');
        toast.error('Form not found locally');
        return null;
      }
      const hasCover = !!stored.schema.coverImage?.startsWith('data:');
      const isSealed =
        options.mode === 'on-chain' && options.access === 'private';
      const isPaid = options.mode === 'on-chain' && options.access === 'paid';
      const flow: Array<{ id: string; label: string }> = [];
      if (hasCover) flow.push({ id: 'cover', label: 'Uploading cover image to Walrus' });
      flow.push(
        { id: 'sign', label: 'Sign the publish transaction in your wallet' },
        { id: 'broadcast', label: 'Broadcasting to Sui' },
        { id: 'confirm', label: 'Confirming on-chain' },
      );
      if (isSealed) flow.push({ id: 'seal', label: 'Sealing schema (private form)' });
      if (isPaid) flow.push({ id: 'treasury', label: 'Setting up paid-form treasury' });
      steps.start(flow);

      try {
        if (hasCover) {
          steps.advance('cover', 'Wallet may prompt to sign a Walrus storage tx.');
        }
        const publishSchema = await uploadCoverImageIfNeeded(stored, uploadBlob);

        const { tx, needsSealedSchemaFollowUp } = buildPublishTx({
          sender,
          packageId,
          schema: publishSchema,
          options,
        });

        steps.advance('sign', 'Approve the transaction in your wallet.');
        const { digest } = await execute({ transaction: tx });
        steps.advance('broadcast');

        steps.advance('confirm');
        const ids = await extractPublishIds(suiClient, digest, originalPackageId ?? packageId);
        if (!ids.formObjectId || !ids.formOwnerCapId) {
          throw new Error('Publish succeeded but Form/FormOwnerCap ids missing from effects');
        }
        const followUpDigests: string[] = [];

        // Tier-3 follow-ups are NON-FATAL: the Form already exists on-chain, so
        // a follow-up failure must NOT report "Publish failed" (which would hide
        // the live form and leave the user no signal to recover). Each is
        // isolated so a failure warns + continues to draft-delete + success.
        if (needsSealedSchemaFollowUp && originalPackageId && seal) {
          steps.advance('seal', 'Encrypting schema with Seal — one extra wallet sign.');
          try {
            const sealDigest = await runSealedSchemaFollowUp({
              formId,
              packageId,
              originalPackageId,
              formObjectId: ids.formObjectId,
              formOwnerCapId: ids.formOwnerCapId,
              seal,
              execute,
            });
            followUpDigests.push(sealDigest);
          } catch (e) {
            console.warn('Sealed-schema follow-up failed (non-fatal) — form is live with a placeholder schema; retry from Manage', e);
            toast.warning('Form published, but sealing the schema failed — open Manage to retry before sharing.');
          }
        }

        if (options.mode === 'on-chain' && options.access === 'paid') {
          steps.advance('treasury', 'Creating an on-chain treasury to collect submission fees.');
          try {
            const treasuryDigest = await runTreasuryFollowUp({
              packageId,
              formOwnerCapId: ids.formOwnerCapId,
              execute,
            });
            followUpDigests.push(treasuryDigest);
          } catch (e) {
            console.warn('Treasury follow-up failed (non-fatal) — form is live but cannot accept paid submissions until a treasury exists; retry from Manage', e);
            toast.warning('Form published, but treasury setup failed — open Manage to create it before accepting paid submissions.');
          }
        }

        // Best-effort: if this draft came from a free marketplace template
        // (no purchaseDigest), bump the source template's clone_count so the
        // marketplace metric stays accurate. Failure is non-fatal — the
        // primary publish already succeeded.
        const src = stored.sourceTemplate;
        if (src && !src.purchaseDigest) {
          try {
            const recordTx = buildRecordFreeCloneTx({
              packageId,
              templateId: src.templateId,
            });
            const { digest: recordDigest } = await execute({ transaction: recordTx });
            followUpDigests.push(recordDigest);
          } catch (e) {
            console.warn('Failed to record free-clone count bump (non-fatal)', e);
          }
        }

        // Draft has been promoted to an on-chain Form — chain is the source
        // of truth now. Drop the IDB entry so it disappears from Drafts and
        // won't drift as the creator edits the on-chain form later.
        try {
          await formDb.delete(formId);
        } catch (e) {
          console.warn('Failed to delete draft from IDB after publish', e);
        }
        usePublishStore.getState().clearPublished(formId);
        await invalidateChain(digest);
        for (const followUpDigest of followUpDigests) {
          await invalidateChain(followUpDigest);
        }

        steps.finishOk();
        toast.success(buildSuccessMessage(options));
        return {
          formObjectId: ids.formObjectId,
          formOwnerCapId: ids.formOwnerCapId,
          mode: options.mode === 'on-chain' ? 'on-chain' : 'template',
        };
      } catch (err) {
        steps.finishError();
        setPublishState(formId, 'error');
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Publish failed: ${msg}`);
        console.error(err);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      sender,
      packageId,
      originalPackageId,
      suiClient,
      seal,
      execute,
      invalidateChain,
      setPublishState,
      uploadBlob,
      formId,
      steps,
    ],
  );

  return {
    isSubmitting,
    publish,
    isReady: Boolean(packageId),
    steps,
  };
}

interface SealedSchemaFollowUpInput {
  formId: string;
  packageId: string;
  originalPackageId: string;
  formObjectId: string;
  formOwnerCapId: string;
  seal: NonNullable<ReturnType<typeof useSealClient>>;
  execute: ReturnType<typeof useExecuteTransaction>['execute'];
}

/**
 * The publish PTB wrote a 1-byte placeholder schema. Now that formObjectId
 * exists, encrypt the real schema (Seal identity = formObjectId.bytes32) and
 * rewrite the schema field via update_schema. Failure leaves the form
 * publishable-but-unreadable; recoverable by re-running.
 */
async function runSealedSchemaFollowUp(input: SealedSchemaFollowUpInput): Promise<string> {
  const { formId, packageId, originalPackageId, formObjectId, formOwnerCapId, seal, execute } =
    input;
  const stored = await formDb.getById(formId);
  if (!stored) throw new Error('Draft missing — cannot encrypt schema');
  const plaintext = new TextEncoder().encode(JSON.stringify(stored.schema));
  const { ciphertext } = await sealEncryptSchema({
    seal,
    // Seal identity namespace is stable — must match the original package
    // address even after upgrades.
    packageId: originalPackageId,
    objectId: formObjectId,
    plaintext,
  });
  const tx = buildUpdateSchemaTx({
    packageId,
    formObjectId,
    formOwnerCapId,
    schemaBytes: ciphertext,
  });
  const { digest } = await execute({ transaction: tx });
  return digest;
}

interface TreasuryFollowUpInput {
  packageId: string;
  formOwnerCapId: string;
  execute: ReturnType<typeof useExecuteTransaction>['execute'];
}

/**
 * Paid forms need a follow-up tx: mint + share a FormTreasury bound to the
 * cap. Can't fold into the publish PTB because create_and_share
 * transferObjects-es the cap to the sender — once it's transferred, the PTB
 * can't borrow it again as an arg. Two-step is acceptable; failure here
 * leaves the form publishable-but-not-submittable, recoverable by re-running.
 */
async function runTreasuryFollowUp(input: TreasuryFollowUpInput): Promise<string> {
  const { packageId, formOwnerCapId, execute } = input;
  const tx = buildCreateTreasuryTx({ packageId, formOwnerCapId });
  const { digest } = await execute({ transaction: tx });
  return digest;
}

function buildSuccessMessage(options: PublishOptions): string {
  if (options.mode === 'on-chain') {
    if (options.access === 'paid') return 'Paid form published — treasury created';
    if (options.access === 'token') return 'Token-gated form published';
    if (options.access === 'private') return 'Private form published';
    return 'Form published on-chain';
  }
  return options.pricing === 'paid' ? `Listed at ${options.priceSui} SUI` : 'Template shared free';
}
