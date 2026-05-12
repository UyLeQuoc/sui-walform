'use client';

import { useState } from 'react';
import { useSuiClientQuery } from '@mysten/dapp-kit';
import { toast } from 'sonner';
import { useActivePackageId } from '../../sui/package-id';
import { useIsPlatformAdmin } from '../../sui/use-platform-admin';
import { buildWithdrawPlatformTx } from '../../sui/tx/withdraw-platform';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';
import { formatSui } from '../lib/sui-amount';

export interface PlatformTreasuryState {
  /** Shared `PlatformTreasury` objectId resolved from `NEXT_PUBLIC_PLATFORM_TREASURY_ID`. */
  treasuryId: string | null;
  /** Current pool balance in MIST. */
  balanceMist: bigint;
  /** Connected wallet owns a `PlatformAdminCap`. */
  isAdmin: boolean;
  /** The admin cap objectId held by the connected wallet (first match). */
  adminCapId: string | null;
  /** Connected wallet address; null when disconnected. */
  sender: string | null;
  isLoading: boolean;
  error: Error | null;
}

export interface UsePlatformTreasuryResult extends PlatformTreasuryState {
  /** Withdraws `amountMist` to `recipient` (defaults to connected wallet). */
  withdraw: (amountMist: bigint, recipient?: string) => Promise<void>;
  /** Shortcut: withdraws the entire balance to `recipient` (defaults to connected wallet). */
  withdrawAll: (recipient?: string) => Promise<void>;
  isWithdrawing: boolean;
}

/**
 * Owns platform-admin treasury state + actions. Detects the connected wallet's
 * `PlatformAdminCap` by querying owned objects filtered on `originalPackageId
 * ::template::PlatformAdminCap` — whoever holds the cap is the admin, no
 * hardcoded address. The treasury id comes from
 * `NEXT_PUBLIC_PLATFORM_TREASURY_ID` (shared object, one per package).
 *
 * The withdraw tx is signed and paid by the admin's connected wallet per the
 * project-wide user-paid policy — no server route.
 */
export function usePlatformTreasury(): UsePlatformTreasuryResult {
  const packageId = useActivePackageId();
  const { execute, sender } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const { isAdmin, adminCapId, isLoading: isCapLoading } = useIsPlatformAdmin();

  const treasuryId = process.env.NEXT_PUBLIC_PLATFORM_TREASURY_ID ?? null;

  const treasuryQuery = useSuiClientQuery(
    'getObject',
    {
      id: treasuryId ?? '',
      options: { showContent: true, showType: true },
    },
    { enabled: !!treasuryId },
  );

  const balanceMist = readBalance(treasuryQuery.data);

  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const runWithdraw = async (amountMist: bigint, recipientOverride?: string) => {
    if (!packageId || !treasuryId || !adminCapId || !sender) return;
    if (amountMist <= 0n) {
      toast.error('Enter an amount greater than zero.');
      return;
    }
    if (amountMist > balanceMist) {
      toast.error(`Treasury only has ${formatSui(balanceMist)} SUI.`);
      return;
    }
    setIsWithdrawing(true);
    try {
      const tx = buildWithdrawPlatformTx({
        packageId,
        platformAdminCapId: adminCapId,
        platformTreasuryId: treasuryId,
        amountMist,
        recipient: recipientOverride ?? sender,
      });
      const { digest } = await execute({ transaction: tx });
      await invalidateChain(digest);
      toast.success(`Withdrew ${formatSui(amountMist)} SUI.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Withdraw failed: ${msg}`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const isLoading = isCapLoading || (!!treasuryId && treasuryQuery.isPending);
  const error = (treasuryQuery.error as Error | null) ?? null;

  return {
    treasuryId,
    balanceMist,
    isAdmin,
    adminCapId,
    sender,
    isLoading,
    error,
    withdraw: runWithdraw,
    withdrawAll: (recipient) => runWithdraw(balanceMist, recipient),
    isWithdrawing,
  };
}

type GetObjectData = ReturnType<typeof useSuiClientQuery<'getObject'>>['data'];

function readBalance(data: GetObjectData): bigint {
  const obj = data?.data;
  if (!obj) return 0n;
  const content = obj.content as unknown as
    | {
        dataType: 'moveObject';
        fields: { balance?: string | number };
      }
    | undefined;
  const raw = content?.fields?.balance;
  return raw != null ? BigInt(raw) : 0n;
}
