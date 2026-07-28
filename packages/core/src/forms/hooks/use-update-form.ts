'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { sealEncryptSchema, useSealClient } from '../../crypto';
import { useActivePackageId, useOriginalPackageId } from '../../sui/package-id';
import { buildUpdateSchemaTx } from '../../sui/tx/update-schema';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';
import { useFormBuilderStore } from '../store/form-builder-store';
import { useOnChainForms } from './use-on-chain-forms';
import { useTxSteps, type UseTxStepsResult } from './use-tx-steps';

export interface UseUpdateFormInput {
  /** The shared Form object id being edited. */
  formObjectId: string;
  /**
   * True when the form was published with a Seal-encrypted schema. The update
   * must then re-encrypt before writing, or the save would silently publish
   * the questions in plaintext — a privacy regression the creator never asked
   * for. Identity + namespace match the publish-time follow-up exactly, so the
   * existing `seal_approve_read_form_schema` policy keeps working.
   */
  schemaSealed?: boolean;
}

export interface UseUpdateFormResult {
  isSubmitting: boolean;
  /** Push the current editor schema to chain via `update_schema`. Returns the
   *  digest on success, or null on failure / not-owner / not-configured. */
  update: () => Promise<{ digest: string } | null>;
  /** True iff the connected wallet owns this form (FormOwnerCap found) and the
   *  active network has a deployed walform package. */
  isReady: boolean;
  steps: UseTxStepsResult;
}

/**
 * Edit-in-place for a published Form. Resolves the caller's FormOwnerCap for
 * `formObjectId`, then rewrites the on-chain schema bytes with whatever the
 * editor store currently holds — re-encrypting first when the form was
 * published sealed. Contract-free: reuses the existing `update_schema` entry
 * function either way.
 */
export function useUpdateForm({
  formObjectId,
  schemaSealed = false,
}: UseUpdateFormInput): UseUpdateFormResult {
  const packageId = useActivePackageId();
  const originalPackageId = useOriginalPackageId();
  const seal = useSealClient();
  const { execute, sender } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const { running, ended } = useOnChainForms();
  const steps = useTxSteps();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const target = normalizeSuiAddress(formObjectId);
  const formOwnerCapId =
    [...running, ...ended].find((f) => normalizeSuiAddress(f.formId) === target)?.capId ?? null;

  const isReady = Boolean(packageId && formOwnerCapId);

  const update = useCallback(async (): Promise<{ digest: string } | null> => {
    if (!sender || !packageId) {
      toast.error('Connect a wallet on a network with a deployed walform package.');
      return null;
    }
    if (!formOwnerCapId) {
      toast.error('You are not the owner of this form (no FormOwnerCap found).');
      return null;
    }
    if (schemaSealed && (!seal || !originalPackageId)) {
      toast.error('Seal is not configured for this network — cannot re-encrypt the schema.');
      return null;
    }
    setIsSubmitting(true);
    steps.start([
      ...(schemaSealed ? [{ id: 'encrypt', label: 'Re-encrypting the schema with Seal' }] : []),
      { id: 'sign', label: 'Sign the update transaction in your wallet' },
      { id: 'broadcast', label: 'Broadcasting to Sui' },
      { id: 'confirm', label: 'Confirming on-chain' },
    ]);
    try {
      const schema = useFormBuilderStore.getState().schema;
      const plaintext = new TextEncoder().encode(JSON.stringify(schema));
      let schemaBytes: Uint8Array = plaintext;
      if (schemaSealed && seal && originalPackageId) {
        steps.advance('encrypt');
        // Identity + namespace must match the publish-time follow-up
        // (`runSealedSchemaFollowUp`): identity = formObjectId.bytes32, package
        // = originalPackageId (stable across upgrades). Anything else produces
        // a ciphertext the existing seal_approve policy can't authorize.
        const { ciphertext } = await sealEncryptSchema({
          seal,
          packageId: originalPackageId,
          objectId: formObjectId,
          plaintext,
        });
        schemaBytes = ciphertext;
      }
      const tx = buildUpdateSchemaTx({ packageId, formObjectId, formOwnerCapId, schemaBytes });

      steps.advance('sign', 'Approve the transaction in your wallet.');
      const { digest } = await execute({ transaction: tx });
      steps.advance('broadcast');
      steps.advance('confirm');
      await invalidateChain(digest);

      steps.finishOk();
      toast.success('Form updated on-chain');
      return { digest };
    } catch (err) {
      steps.finishError();
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Update failed: ${msg}`);
      console.error(err);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    sender,
    packageId,
    originalPackageId,
    seal,
    schemaSealed,
    formOwnerCapId,
    formObjectId,
    execute,
    invalidateChain,
    steps,
  ]);

  return { isSubmitting, update, isReady, steps };
}
