'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { Transaction } from '@mysten/sui/transactions';
import { useActiveNetwork, useSponsorConfigId, getWalCoinType } from '../../sui/env-network';
import { useActivePackageId } from '../../sui/package-id';
import {
  buildCreateSponsorPoolTx,
  buildFundSponsorPoolTx,
  buildUpdateSponsorPoolTx,
  buildWithdrawSponsorPoolTx,
} from '../../sui/tx/sponsor-pool';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';
import { DEFAULT_SPONSOR_POOL_LIMITS } from '../lib/sponsor-pool';
import { formatSui, formatWal } from '../lib/sui-amount';
import type { SponsorPoolState } from '../../types';

export interface UseSponsorPoolActionsInput {
  /** FormOwnerCap id — proves ownership for create / withdraw / pause. */
  capId: string;
  pool: SponsorPoolState | null;
}

export interface UseSponsorPoolActionsResult {
  /** Opens the pool (default limits) and funds it in one transaction. */
  open: (funding: { walFrost: bigint; suiMist: bigint }) => Promise<void>;
  /** Tops the pool up from the connected wallet. */
  fund: (funding: { walFrost: bigint; suiMist: bigint }) => Promise<void>;
  /** Returns every WAL + SUI left in the pool to the connected wallet. */
  withdrawAll: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  isMutating: boolean;
}

/**
 * Owner-side actions for a form's Walrus sponsorship pool. Funding is open to
 * any wallet on-chain; this hook is the creator's view of it.
 */
export function useSponsorPoolActions(
  input: UseSponsorPoolActionsInput,
): UseSponsorPoolActionsResult {
  const { capId, pool } = input;
  const packageId = useActivePackageId();
  const configId = useSponsorConfigId();
  const network = useActiveNetwork();
  const { execute, sender } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const [isMutating, setIsMutating] = useState(false);

  // `build(suiFrom)` is called twice when the tx moves SUI: the sponsored
  // variant pays from owned coins, the wallet-paid fallback from the gas coin.
  const run = async (
    label: string,
    build: (suiFrom: 'owned' | 'gas') => Transaction,
    done: string,
  ) => {
    setIsMutating(true);
    try {
      const { digest } = await execute({
        transaction: build('owned'),
        walletTransaction: build('gas'),
      });
      await invalidateChain(digest);
      toast.success(done);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${label} failed: ${msg}`);
    } finally {
      setIsMutating(false);
    }
  };

  const open = async (funding: { walFrost: bigint; suiMist: bigint }) => {
    if (!packageId || !configId || !network) return;
    await run(
      'Opening sponsorship',
      (suiFrom) =>
        buildCreateSponsorPoolTx({
          packageId,
          configId,
          formOwnerCapId: capId,
          limits: DEFAULT_SPONSOR_POOL_LIMITS,
          funding: {
            wal: funding.walFrost,
            sui: funding.suiMist,
            walCoinType: getWalCoinType(network),
            suiFrom,
          },
        }),
      `Sponsorship open with ${formatWal(funding.walFrost)} WAL + ${formatSui(funding.suiMist)} SUI.`,
    );
  };

  const fund = async (funding: { walFrost: bigint; suiMist: bigint }) => {
    if (!packageId || !network || !pool) return;
    await run(
      'Funding',
      (suiFrom) =>
        buildFundSponsorPoolTx({
          packageId,
          poolId: pool.poolId,
          funding: {
            wal: funding.walFrost,
            sui: funding.suiMist,
            walCoinType: getWalCoinType(network),
            suiFrom,
          },
        }),
      `Added ${formatWal(funding.walFrost)} WAL + ${formatSui(funding.suiMist)} SUI.`,
    );
  };

  const withdrawAll = async () => {
    if (!packageId || !pool || !sender) return;
    await run(
      'Withdraw',
      () =>
        buildWithdrawSponsorPoolTx({
          packageId,
          poolId: pool.poolId,
          formOwnerCapId: capId,
          recipient: sender,
          wal: pool.walFrost,
          sui: pool.suiMist,
        }),
      `Withdrew ${formatWal(pool.walFrost)} WAL + ${formatSui(pool.suiMist)} SUI.`,
    );
  };

  const setEnabled = async (enabled: boolean) => {
    if (!packageId || !pool) return;
    await run(
      enabled ? 'Resuming sponsorship' : 'Pausing sponsorship',
      () =>
        buildUpdateSponsorPoolTx({
          packageId,
          poolId: pool.poolId,
          formOwnerCapId: capId,
          enabled,
        }),
      enabled ? 'Sponsorship resumed.' : 'Sponsorship paused - respondents pay their own storage.',
    );
  };

  return { open, fund, withdrawAll, setEnabled, isMutating };
}
