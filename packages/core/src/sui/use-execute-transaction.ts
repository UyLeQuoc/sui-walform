'use client';

import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClientContext,
} from '@mysten/dapp-kit';
import { useCallback } from 'react';
import { Transaction } from '@mysten/sui/transactions';

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
  via: 'wallet';
}

export interface UseExecuteTransactionResult {
  execute: (input: ExecuteTransactionInput) => Promise<ExecuteTransactionResult>;
  sender: string | null;
  network: SuiNetwork;
}

/**
 * Single entry point for every on-chain action in WalForm.
 * Every transaction is signed and paid by the connected wallet.
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
      const chain = `sui:${net}` as const;
      const result = await signAndExecuteTransaction({
        transaction: input.transaction,
        chain,
      });
      return { digest: result.digest, via: 'wallet' };
    },
    [account?.address, network, signAndExecuteTransaction],
  );

  return {
    execute,
    sender: account?.address ?? null,
    network: network as SuiNetwork,
  };
}
