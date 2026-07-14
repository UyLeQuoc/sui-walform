'use client';

import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSignTransaction,
  useSuiClient,
  useSuiClientContext,
} from '@mysten/dapp-kit';
import { useCallback } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';

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
  via: 'wallet' | 'sponsor';
}

export interface UseExecuteTransactionResult {
  execute: (input: ExecuteTransactionInput) => Promise<ExecuteTransactionResult>;
  sender: string | null;
  network: SuiNetwork;
}

/** Enoki gas-sponsor endpoint (Supabase Edge Function). Unset → wallet-paid. */
function sponsorUrl(): string | null {
  return process.env.NEXT_PUBLIC_SPONSOR_URL?.trim() || null;
}

/** True iff a gas sponsor is configured for this network (Enoki: testnet/mainnet). */
export function isGasSponsored(network: string): boolean {
  return !!sponsorUrl() && (network === 'testnet' || network === 'mainnet');
}

/**
 * Single entry point for every on-chain action in WalForm.
 *
 * Tries the Enoki gas sponsor first (platform pays gas → Web2 users with 0 SUI
 * can still transact); the user only signs, never pays gas. ANY sponsor failure
 * falls back to wallet-paid `signAndExecute`, so a sponsor outage never blocks a
 * transaction — worst case is the pre-sponsor behaviour.
 */
export function useExecuteTransaction(): UseExecuteTransactionResult {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { network } = useSuiClientContext();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { mutateAsync: signTransaction } = useSignTransaction();

  const execute = useCallback(
    async (input: ExecuteTransactionInput): Promise<ExecuteTransactionResult> => {
      if (!account?.address) {
        throw new Error('Connect a wallet to sign this transaction.');
      }
      const net = network as SuiNetwork;
      const chain = `sui:${net}` as const;
      const url = sponsorUrl();

      // ── Sponsored path (Enoki pays gas) ──────────────────────────────────
      if (url && (net === 'testnet' || net === 'mainnet')) {
        try {
          const kindBytes = await input.transaction.build({
            client: suiClient,
            onlyTransactionKind: true,
          });
          const created = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              network: net,
              transactionKindBytes: toBase64(kindBytes),
              sender: account.address,
            }),
          });
          if (!created.ok) throw new Error(`sponsor create failed (${created.status})`);
          const { bytes, digest } = (await created.json()) as { bytes: string; digest: string };

          // User signs the sponsor-built tx (sign only — the sponsor executes + pays gas).
          const { signature } = await signTransaction({
            transaction: Transaction.from(bytes),
            chain,
          });

          const executed = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'execute', digest, signature }),
          });
          if (!executed.ok) throw new Error(`sponsor execute failed (${executed.status})`);
          const { digest: finalDigest } = (await executed.json()) as { digest: string };
          return { digest: finalDigest, via: 'sponsor' };
        } catch (e) {
          // Non-fatal: fall back to wallet-paid so an outage never blocks a tx.
          console.warn('Sponsored execution failed — falling back to wallet-paid.', e);
        }
      }

      // ── Wallet-paid fallback ─────────────────────────────────────────────
      const result = await signAndExecuteTransaction({ transaction: input.transaction, chain });
      return { digest: result.digest, via: 'wallet' };
    },
    [account?.address, network, suiClient, signAndExecuteTransaction, signTransaction],
  );

  return {
    execute,
    sender: account?.address ?? null,
    network: network as SuiNetwork,
  };
}
