'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  useCurrentAccount,
  useCurrentWallet,
  useSuiClient,
  useSuiClientQuery,
} from '@mysten/dapp-kit';
import type { FieldValues } from 'react-hook-form';
import { sealEncryptSubmission, getSealClient } from '../../crypto';
import { useActivePackageId, useOriginalPackageId } from '../../sui/package-id';
import { buildSubmitTx } from '../../sui/tx/submit';
import { buildPaidSubmitTx, InsufficientSuiError } from '../../sui/tx/submit-paid';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';
import { formatSui } from '../lib/sui-amount';
import { useFormAllowlist } from './use-form-allowlist';
import { useFormTreasury } from './use-form-treasury';
import type { FormOnChainDetail } from './use-form-on-chain';

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

export interface UseFormSubmissionResult {
  /**
   * Submit handler matching `FormPreview`'s `onSubmit` prop. Encrypts +
   * builds the right tx (paid vs free) + signs/broadcasts via the connected
   * wallet (respondent pays gas).
   */
  submit: (values: FieldValues) => Promise<void>;
  isSubmitting: boolean;
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
  const suiClient = useSuiClient();
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

  const [connectOpen, setConnectOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<FieldValues | null>(null);

  const submit = useCallback(
    async (values: FieldValues): Promise<void> => {
      if (!isConnected || !account) {
        // Defer submit until connect resolves; FormPreview reset fires
        // post-onSubmit so re-submit isn't trivial. Stash + show modal.
        setPendingSubmission(values);
        setConnectOpen(true);
        return;
      }
      if (!packageId || !originalPackageId) {
        toast.error('walform package not configured for this network.');
        return;
      }
      if (form.accessMode === 2 && !meetsTokenGate) {
        toast.error(
          `Need at least ${form.requiredTokenAmount.toString()} of ${form.requiredTokenType} to submit.`,
        );
        return;
      }

      const allowlistId = await resolveAllowlistId({
        form,
        accountAddress: account.address,
        allowlistQuery,
      });
      if (allowlistId === null) return;

      if (form.accessMode === 3 && !treasuryQuery.treasury) {
        toast.error(
          treasuryQuery.isLoading
            ? 'Resolving treasury…'
            : 'No treasury found for this paid form. The creator may need to re-publish.',
        );
        return;
      }

      setIsSubmitting(true);
      try {
        const seal = getSealClient(suiClient);
        const plaintext = new TextEncoder().encode(JSON.stringify(values));
        const { ciphertext, nonce } = await sealEncryptSubmission({
          seal,
          // Use originalPackageId for Seal identity namespace stability.
          packageId: originalPackageId,
          formObjectId: form.formObjectId,
          plaintext,
        });

        const tx =
          form.accessMode === 3
            ? await buildPaid({
                packageId,
                form,
                treasuryId: treasuryQuery.treasury!.treasuryId,
                ciphertext,
                nonce,
                ownerAddress: account.address,
                suiClient,
              })
            : buildSubmitTx({
                packageId,
                formObjectId: form.formObjectId,
                allowlistObjectId: allowlistId,
                encryptedBody: ciphertext,
                fileBlobIds: [],
                nonce,
                share: true,
              });

        const { digest } = await execute({ transaction: tx });
        await invalidateChain(digest);
        toast.success(
          form.schema?.settings.successMessage ?? 'Thanks — your response was recorded',
        );
        setPendingSubmission(null);
      } catch (err) {
        if (err instanceof InsufficientSuiError) {
          toast.error(`Need at least ${formatSui(err.required)} SUI to pay the submission fee.`);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`Submit failed: ${msg}`);
        }
        console.error(err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isConnected,
      account,
      packageId,
      originalPackageId,
      form,
      meetsTokenGate,
      allowlistQuery,
      treasuryQuery,
      suiClient,
      execute,
      invalidateChain,
    ],
  );

  const onConnected = useCallback(() => {
    if (pendingSubmission) {
      const values = pendingSubmission;
      setPendingSubmission(null);
      void submit(values);
    }
  }, [pendingSubmission, submit]);

  return {
    submit,
    isSubmitting,
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

interface ResolveAllowlistInput {
  form: FormOnChainDetail;
  accountAddress: string;
  allowlistQuery: ReturnType<typeof useFormAllowlist>;
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
  const { form, accountAddress, allowlistQuery } = input;

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
    const isMember = al.members.some((m) => m === accountAddress);
    if (!isMember && accountAddress !== form.owner) {
      toast.error("Your wallet isn't on this form's allowlist.");
      return null;
    }
    return al.allowlistId;
  }
  if (form.accessMode === 0 || form.accessMode === 2) {
    const al = allowlistQuery.allowlist;
    if (al) return al.allowlistId;
    const throwaway = process.env.NEXT_PUBLIC_PUBLIC_SUBMIT_ALLOWLIST_ID;
    if (!throwaway) {
      toast.error('No allowlist available. Re-publish the form, or run setup-public-allowlist.');
      return null;
    }
    return throwaway;
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
