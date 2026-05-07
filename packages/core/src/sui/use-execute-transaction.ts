'use client';

import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClientContext,
} from '@mysten/dapp-kit';
import { useCallback } from 'react';
import type { Transaction } from '@mysten/sui/transactions';

export type SuiNetwork = 'testnet' | 'mainnet' | 'devnet';

export interface ExecuteTransactionInput {
  /**
   * Built `Transaction` instance. Pass a freshly built tx per call —
   * `useSignAndExecuteTransaction` consumes it (sets sender, gas, etc.). To
   * retry after a wallet rejection, re-run the tx builder.
   */
  transaction: Transaction;
}

export interface ExecuteTransactionResult {
  digest: string;
}

export interface UseExecuteTransactionResult {
  /**
   * Sign-and-broadcast a transaction with the connected wallet. The wallet
   * pays gas. Throws if no wallet is connected or the wallet rejects.
   *
   * Does NOT invalidate React Query caches — the caller decides when to
   * invalidate via `useInvalidateChainQueries()` (typically after the last
   * tx of a multi-step flow). Keeps the helper composable.
   */
  execute: (input: ExecuteTransactionInput) => Promise<ExecuteTransactionResult>;
  /** Connected wallet's address, or null when disconnected. */
  sender: string | null;
  /** Active network from `useSuiClientContext`. */
  network: SuiNetwork;
}

/**
 * Single entry point for every user-paid on-chain action in WalForm.
 *
 * Wraps `@mysten/dapp-kit`'s `useSignAndExecuteTransaction` with two
 * project-wide conventions:
 *
 *   1. Pins the active `chain` (`sui:${network}`) so wallets can't broadcast
 *      on the wrong network.
 *   2. Surfaces a clean `{ execute, sender, network }` triple matching the
 *      action-hook shape used elsewhere in the codebase.
 *
 * Every WalForm tx goes through this — there is no app-level transaction
 * sponsorship and no `/api/sponsor` route.
 */
export function useExecuteTransaction(): UseExecuteTransactionResult {
  const account = useCurrentAccount();
  const { network } = useSuiClientContext();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const execute = useCallback(
    async (input: ExecuteTransactionInput): Promise<ExecuteTransactionResult> => {
      if (!account?.address) {
        throw new Error('Connect a wallet to sign this transaction.');
      }
      const net = network as SuiNetwork;
      const result = await signAndExecuteTransaction({
        transaction: input.transaction,
        chain: `sui:${net}`,
      });
      return { digest: result.digest };
    },
    [account?.address, network, signAndExecuteTransaction],
  );

  return {
    execute,
    sender: account?.address ?? null,
    network: network as SuiNetwork,
  };
}
