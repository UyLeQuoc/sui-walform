'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { getWalCoinType, useActiveNetwork } from '../../sui/env-network';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import { buildExtendSharedBlobsTx } from '../../sui/tx/extend-shared-blobs';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';
import { findFormBlobs } from '../../walrus/form-blobs';
import { getWalrusClient } from '../../walrus/walrus-client';
import { extensionPlan } from '../lib/walrus-storage';
import { formatWal } from '../lib/sui-amount';
import type { StoredBlobState } from '../../types';

export interface FormStorageSnapshot {
  blobs: StoredBlobState[];
  /** Walrus-backed submissions only their respondent can extend. */
  respondentOwned: number;
  currentEpoch: number;
  epochDurationMs: number;
  /** Walrus won't store anything past currentEpoch + this. */
  maxEpochsAhead: number;
  storagePricePerUnit: bigint;
  walrusPackageId: string;
  systemObjectId: string;
}

export type UseFormStorageResult =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; snapshot: FormStorageSnapshot };

/** A form's submission blobs on Walrus plus the Walrus state needed to extend them. */
export function useFormStorage(formId: string): UseFormStorageResult {
  const { network } = useSuiClientContext();
  const activeNetwork = useActiveNetwork();
  const client = useSuiGrpcClient();
  const query = useQuery({
    queryKey: [network, 'walform:form-storage', formId],
    enabled: !!activeNetwork,
    staleTime: 30_000,
    queryFn: async (): Promise<FormStorageSnapshot> => {
      const walrus = await getWalrusClient(client, activeNetwork!);
      const [found, system, state, staking] = await Promise.all([
        findFormBlobs(client, activeNetwork!, formId),
        walrus.systemObject(),
        walrus.systemState(),
        walrus.stakingState(),
      ]);
      return {
        ...found,
        currentEpoch: staking.epoch,
        epochDurationMs: Number(staking.epoch_duration),
        maxEpochsAhead: state.future_accounting.length,
        storagePricePerUnit: BigInt(state.storage_price_per_unit_size),
        walrusPackageId: system.package_id,
        systemObjectId: system.id,
      };
    },
  });
  if (!activeNetwork) return { status: 'unavailable' };
  if (query.isPending) return { status: 'loading' };
  if (query.isError) return { status: 'error', error: query.error };
  return { status: 'success', snapshot: query.data };
}

/** Extends every still-live submission blob of a form, paid from the connected wallet. */
export function useExtendFormStorage(): {
  execute: (snapshot: FormStorageSnapshot, epochs: number) => Promise<void>;
  isPending: boolean;
} {
  const network = useActiveNetwork();
  const { execute } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const [isPending, setIsPending] = useState(false);

  const extend = async (snapshot: FormStorageSnapshot, epochs: number) => {
    if (!network) return;
    const plan = extensionPlan(snapshot, epochs);
    if (plan.items.length === 0) {
      toast.error('Nothing to extend - every file has expired or is already at the limit.');
      return;
    }
    setIsPending(true);
    try {
      const tx = buildExtendSharedBlobsTx({
        walrusPackageId: snapshot.walrusPackageId,
        systemObjectId: snapshot.systemObjectId,
        walCoinType: getWalCoinType(network),
        epochs,
        items: plan.items,
      });
      const { digest } = await execute({ transaction: tx });
      await invalidateChain(digest);
      toast.success(
        `Extended ${plan.items.length} file${plan.items.length === 1 ? '' : 's'} by ${epochs} epochs for ${formatWal(plan.totalTopUpFrost)} WAL.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Extend failed: ${msg}`);
    } finally {
      setIsPending(false);
    }
  };

  return { execute: extend, isPending };
}
