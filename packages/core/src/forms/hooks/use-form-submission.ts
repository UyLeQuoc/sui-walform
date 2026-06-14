'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  useCurrentAccount,
  useCurrentWallet,
  useSuiClient,
  useSuiClientQuery,
} from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import type { FieldValues } from 'react-hook-form';
import { sealEncryptSubmission, useSealClient } from '../../crypto';
import { useActivePackageId, useOriginalPackageId } from '../../sui/package-id';
import { useActivePublicAllowlistId } from '../../sui/env-network';
import { buildSubmitTx } from '../../sui/tx/submit';
import { buildPaidSubmitTx, InsufficientSuiError } from '../../sui/tx/submit-paid';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';
import { encodeBodyPointer, useWalrusWalletUpload } from '../../walrus';
import { formatSui } from '../lib/sui-amount';
import { useFormAllowlist } from './use-form-allowlist';
import { useFormTreasury } from './use-form-treasury';
import { useTxSteps, type UseTxStepsResult } from './use-tx-steps';
import type { FormOnChainDetail } from './use-form-on-chain';
import type { FileAttachmentValue } from '../../types';

/**
 * Off-chain token-balance gate state. Renderers use this to disable Submit
 * + show a banner without waiting for the chain to reject.
 */
export interface TokenGateState {
  /** Balance in raw u64 base units of the required token. */
  held: bigint;
  meets: boolean;
  isPending: boolean;
}

export interface SubmittedSummary {
  /** Sui tx digest of the on-chain submission. */
  digest: string;
  /** Submitter address that signed the tx. */
  submitter: string;
  /** When the success state was set (client clock). */
  submittedAtMs: number;
}

export interface UseFormSubmissionResult {
  /**
   * Submit handler matching `FormPreview`'s `onSubmit` prop. Encrypts +
   * builds the right tx (paid vs free) + signs/broadcasts via the connected
   * wallet (respondent pays gas).
   */
  submit: (values: FieldValues) => Promise<boolean>;
  isSubmitting: boolean;
  /** Step-by-step progress for the submit flow. View layer renders this
   * via `<TxSteps>` to show the user where the wallet sign / Walrus upload /
   * broadcast currently is. */
  steps: UseTxStepsResult;
  /** Most recently completed submission for this session, or null. The view
   * layer flips to a thank-you screen when this is set. */
  submitted: SubmittedSummary | null;
  /** Clears `submitted` so the form is rendered again (e.g. submit another). */
  resetSubmitted: () => void;
  /** Whether the wallet-connect modal is open. Used by the view layer. */
  connectOpen: boolean;
  setConnectOpen: (open: boolean) => void;
  /** Re-fires submit with the stashed values once the wallet connects. */
  onConnected: () => void;
  /** Resolved Allowlist for the form. Surfaced for UI banners. */
  allowlistQuery: ReturnType<typeof useFormAllowlist>;
  /** Resolved FormTreasury (paid forms only). Surfaced for UI banners. */
  treasuryQuery: ReturnType<typeof useFormTreasury>;
  /** Off-chain token-gate snapshot (token-gated forms only). */
  tokenGate: TokenGateState;
  /** Connected wallet's address — null when disconnected. */
  account: ReturnType<typeof useCurrentAccount>;
}

/**
 * End-to-end submission orchestration. Owns Seal encryption, allowlist
 * resolution, paid-coin selection, wallet sign-and-execute, and dApp Kit
 * query invalidation. The view component is left with banners + FormPreview
 * wiring.
 */
export function useFormSubmission(form: FormOnChainDetail): UseFormSubmissionResult {
  const { isConnected } = useCurrentWallet();
  const account = useCurrentAccount();
  const packageId = useActivePackageId();
  const originalPackageId = useOriginalPackageId();
  const publicAllowlistId = useActivePublicAllowlistId();
  const suiClient = useSuiClient();
  const seal = useSealClient();
  const allowlistQuery = useFormAllowlist(form.formObjectId);
  const treasuryQuery = useFormTreasury(form.accessMode === 3 ? form.formObjectId : undefined);
  const tokenBalanceQuery = useSuiClientQuery(
    'getBalance',
    {
      owner: account?.address ?? '',
      coinType: form.requiredTokenType,
    },
    {
      enabled: form.accessMode === 2 && !!account?.address && !!form.requiredTokenType,
    },
  );
  const tokenHeld = tokenBalanceQuery.data?.totalBalance
    ? BigInt(tokenBalanceQuery.data.totalBalance)
    : 0n;
  const meetsTokenGate = form.accessMode !== 2 || tokenHeld >= form.requiredTokenAmount;

  const { execute } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const { uploadBlob, uploadQuilt, isReady: walrusReady } = useWalrusWalletUpload();

  const [connectOpen, setConnectOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<FieldValues | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedSummary | null>(null);
  const steps = useTxSteps();

  const submit = useCallback(
    async (values: FieldValues): Promise<boolean> => {
      if (!isConnected || !account) {
        // Defer submit until connect resolves; FormPreview reset fires
        // post-onSubmit so re-submit isn't trivial. Stash + show modal.
        setPendingSubmission(values);
        setConnectOpen(true);
        return false;
      }
      if (!packageId || !originalPackageId) {
        toast.error('walform package not configured for this network.');
        return false;
      }
      if (form.accessMode === 2 && !meetsTokenGate) {
        toast.error(
          `Need at least ${form.requiredTokenAmount.toString()} of ${form.requiredTokenType} to submit.`,
        );
        return false;
      }

      // Pre-flight gas check. WalForm doesn't sponsor any transactions — the
      // submitter signs and pays SUI gas. A wallet with zero SUI on this
      // network would otherwise surface as the unfriendly low-level
      // "No valid gas coins found for the transaction" error.
      const suiBalance = await suiClient.getBalance({
        owner: account.address,
        coinType: '0x2::sui::SUI',
      });
      if (BigInt(suiBalance.totalBalance) === 0n) {
        toast.error(
          'Your wallet has no SUI to pay gas. Fund it from the testnet faucet and try again.',
        );
        return false;
      }

      const allowlistId = await resolveAllowlistId({
        form,
        accountAddress: account.address,
        allowlistQuery,
        publicAllowlistId,
      });
      if (allowlistId === null) return false;

      if (form.accessMode === 3 && !treasuryQuery.treasury) {
        toast.error(
          treasuryQuery.isLoading
            ? 'Resolving treasury…'
            : 'No treasury found for this paid form. The creator may need to re-publish.',
        );
        return false;
      }

      if (!walrusReady) {
        toast.error(
          'Walrus storage requires a wallet on testnet or mainnet. Switch networks and try again.',
        );
        return false;
      }

      if (!seal) {
        toast.error('Seal not configured for this network.');
        return false;
      }

      setIsSubmitting(true);
      // Work on a shallow clone so we never mutate the RHF-owned `values`
      // object. The file-attachment rewrite below (File → FileAttachmentValue)
      // would otherwise corrupt the caller's snapshot: on a deferred/retry
      // submit `collectPendingFiles` would no longer see the `File`s (already
      // rewritten) and we'd re-encrypt a half-mutated object — and re-upload
      // the attachments, double-spending WAL.
      const submitValues: FieldValues = { ...values };
      // File auto-upload step is only listed when there are pending File
      // objects in `submitValues` — keeps the step list tight when no attachments.
      const pendingFiles = collectPendingFiles(submitValues);
      const flow: Array<{ id: string; label: string }> = [];
      if (pendingFiles.length > 0) {
        flow.push({
          id: 'files',
          label:
            pendingFiles.length === 1
              ? 'Uploading attachment to Walrus'
              : `Bundling ${pendingFiles.length} attachments into a Walrus Quilt`,
        });
      }
      flow.push(
        { id: 'encrypt', label: 'Encrypting your response with Seal' },
        { id: 'walrus', label: 'Storing encrypted body on Walrus' },
        { id: 'sign', label: 'Sign the transaction in your wallet' },
        { id: 'broadcast', label: 'Broadcasting to Sui' },
        { id: 'confirm', label: 'Confirming on-chain' },
      );
      steps.start(flow);
      try {
        // 1. Bundle ALL pending File attachments into a single Walrus Quilt —
        //    one registration tx, one wallet prompt, regardless of N. Replaces
        //    the previous N-writeBlob loop that prompted the wallet once per
        //    file. Each file's resulting aggregator URL slots back into
        //    `values` as a `FileAttachmentValue` before encrypt.
        if (pendingFiles.length > 0) {
          steps.advance(
            'files',
            pendingFiles.length === 1
              ? 'Wallet will prompt to sign one Walrus storage tx.'
              : `Wallet will prompt to sign ONE Walrus storage tx for all ${pendingFiles.length} files.`,
          );
          const fileBytes = await Promise.all(
            pendingFiles.map((p) => p.file.arrayBuffer().then((b) => new Uint8Array(b))),
          );
          const quilt = await uploadQuilt(
            pendingFiles.map(({ fieldId, file }, i) => ({
              // Identifier must be unique within the Quilt — prefix with
              // index so two attachments named `photo.jpg` don't collide.
              identifier: `/${i}-${fieldId}-${file.name}`,
              bytes: fileBytes[i]!,
            })),
            { epochs: 10 },
          );
          quilt.files.forEach((result, i) => {
            const { fieldId, file } = pendingFiles[i]!;
            const next: FileAttachmentValue = {
              url: result.url,
              name: file.name,
              size: file.size,
              type: file.type || '',
            };
            (submitValues as Record<string, unknown>)[fieldId] = next;
          });
        }

        // 2. Encrypt the serialized form values (now with file URLs).
        steps.advance('encrypt');
        const plaintext = new TextEncoder().encode(JSON.stringify(submitValues));
        const { ciphertext, nonce } = await sealEncryptSubmission({
          seal,
          // Use originalPackageId for Seal identity namespace stability.
          packageId: originalPackageId,
          formObjectId: form.formObjectId,
          plaintext,
        });

        // 3. Walrus body pivot: Seal ciphertext goes to Walrus; the Sui
        //    Submission keeps only a short pointer in `encrypted_body`.
        steps.advance('walrus', 'Wallet may prompt to sign a Walrus storage tx.');
        const { blobId } = await uploadBlob(ciphertext, { epochs: 10 });
        const bodyPointer = encodeBodyPointer(blobId);

        // 4. Build + sign the Sui submission tx.
        steps.advance('sign', 'Approve the transaction in your wallet.');
        const tx =
          form.accessMode === 3
            ? await buildPaid({
                packageId,
                form,
                treasuryId: treasuryQuery.treasury!.treasuryId,
                ciphertext: bodyPointer,
                nonce,
                ownerAddress: account.address,
                suiClient,
              })
            : buildSubmitTx({
                packageId,
                formObjectId: form.formObjectId,
                allowlistObjectId: allowlistId,
                encryptedBody: bodyPointer,
                fileBlobIds: [],
                nonce,
                share: true,
              });

        steps.advance('broadcast');
        const { digest } = await execute({ transaction: tx });
        steps.advance('confirm');
        await invalidateChain(digest);
        steps.finishOk();
        setPendingSubmission(null);
        setSubmitted({
          digest,
          submitter: account.address,
          submittedAtMs: Date.now(),
        });
        return true;
      } catch (err) {
        steps.finishError();
        if (err instanceof InsufficientSuiError) {
          toast.error(`Need at least ${formatSui(err.required)} SUI to pay the submission fee.`);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          // Wallets surface a low-level "No valid gas coins found for the
          // transaction" when the connected account holds no SUI on the
          // active network. Map it to a clearer hint — same root cause as
          // the pre-flight branch, but covers races where dust got spent
          // between the pre-flight and the signing prompt.
          if (msg.includes('No valid gas coins') || msg.includes('GasBalanceTooLow')) {
            toast.error(
              'Your wallet has no SUI to pay gas. Fund it from the testnet faucet and try again.',
            );
          } else {
            toast.error(`Submit failed: ${msg}`);
          }
        }
        console.error(err);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isConnected,
      account,
      packageId,
      originalPackageId,
      publicAllowlistId,
      seal,
      form,
      meetsTokenGate,
      allowlistQuery,
      treasuryQuery,
      suiClient,
      execute,
      invalidateChain,
      uploadBlob,
      uploadQuilt,
      walrusReady,
      steps,
    ],
  );

  const onConnected = useCallback(() => {
    if (pendingSubmission) {
      const values = pendingSubmission;
      setPendingSubmission(null);
      void submit(values);
    }
  }, [pendingSubmission, submit]);

  const resetSubmitted = useCallback(() => setSubmitted(null), []);

  return {
    submit,
    isSubmitting,
    steps,
    submitted,
    resetSubmitted,
    connectOpen,
    setConnectOpen,
    onConnected,
    allowlistQuery,
    treasuryQuery,
    tokenGate: {
      held: tokenHeld,
      meets: meetsTokenGate,
      isPending: tokenBalanceQuery.isPending,
    },
    account,
  };
}

/**
 * Walks the form values for raw `File` instances (auto-stored by the new
 * FileField when a respondent picks a file). Returns the (fieldId, file)
 * pairs so the submit flow can upload them to Walrus and rewrite the values
 * with serializable attachment URLs before encryption.
 */
function collectPendingFiles(values: FieldValues): Array<{ fieldId: string; file: File }> {
  const out: Array<{ fieldId: string; file: File }> = [];
  for (const [fieldId, v] of Object.entries(values)) {
    if (typeof File !== 'undefined' && v instanceof File) {
      out.push({ fieldId, file: v });
    }
  }
  return out;
}

interface ResolveAllowlistInput {
  form: FormOnChainDetail;
  accountAddress: string;
  allowlistQuery: ReturnType<typeof useFormAllowlist>;
  publicAllowlistId: string | null;
}

/**
 * Returns the allowlist object id that the submission tx must reference, or
 * null when something went wrong (a toast is fired before returning).
 *
 * - Private (1): per-form Allowlist resolved via event index. Membership is
 *   enforced client-side as a UX hint (chain enforces the real check).
 * - Public (0) / Token (2): submit() still requires an allowlist arg. Prefer
 *   the form's bound allowlist; fall back to the global throwaway.
 * - Paid (3): allowlist is unused by submit_paid_and_share — return ''.
 */
async function resolveAllowlistId(input: ResolveAllowlistInput): Promise<string | null> {
  const { form, accountAddress, allowlistQuery, publicAllowlistId } = input;

  if (form.accessMode === 1) {
    const al = allowlistQuery.allowlist;
    if (!al) {
      toast.error(
        allowlistQuery.isLoading
          ? 'Resolving allowlist…'
          : 'No allowlist found for this private form. The creator may need to re-publish.',
      );
      return null;
    }
    const normalizedAccount = normalizeSuiAddress(accountAddress);
    const isMember = al.members.some((m) => m === normalizedAccount);
    if (!isMember && normalizedAccount !== normalizeSuiAddress(form.owner)) {
      toast.error("Your wallet isn't on this form's allowlist.");
      return null;
    }
    return al.allowlistId;
  }
  if (form.accessMode === 0 || form.accessMode === 2) {
    const al = allowlistQuery.allowlist;
    if (al) return al.allowlistId;
    if (!publicAllowlistId) {
      toast.error('No allowlist available. Re-publish the form, or run setup-public-allowlist.');
      return null;
    }
    return publicAllowlistId;
  }
  // Paid mode — submit_paid_and_share doesn't take an allowlist arg.
  return '';
}

interface BuildPaidInput {
  packageId: string;
  form: FormOnChainDetail;
  treasuryId: string;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  ownerAddress: string;
  suiClient: ReturnType<typeof useSuiClient>;
}

async function buildPaid(input: BuildPaidInput) {
  const { packageId, form, treasuryId, ciphertext, nonce, ownerAddress, suiClient } = input;
  const coins = await suiClient.getCoins({
    owner: ownerAddress,
    coinType: '0x2::sui::SUI',
    limit: 50,
  });
  const { tx } = buildPaidSubmitTx({
    packageId,
    formObjectId: form.formObjectId,
    treasuryId,
    coins: coins.data,
    feeMist: form.submissionFeeMist,
    encryptedBody: ciphertext,
    nonce,
  });
  return tx;
}
