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
import { fromBase64, toBase64 } from '@mysten/sui/utils';

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
  /**
   * Which path actually executed. `'sponsor'` means the Supabase sponsor
   * route paid gas; `'wallet'` means the connected wallet paid (either
   * sponsor was disabled or it failed and we fell back).
   */
  via: 'sponsor' | 'wallet';
}

export interface UseExecuteTransactionResult {
  execute: (input: ExecuteTransactionInput) => Promise<ExecuteTransactionResult>;
  sender: string | null;
  network: SuiNetwork;
}

/**
 * Single entry point for every on-chain action in WalForm.
 *
 * Flow:
 *   1. If `NEXT_PUBLIC_SPONSOR_URL` is set AND the active network is
 *      testnet/mainnet, try the sponsor path:
 *        - Build tx-kind bytes (no sender, no gas).
 *        - POST to /sponsor `{action:'create'}` → Enoki returns sponsored bytes.
 *        - Wallet signs (signTransaction, no execute) — user does NOT pay gas.
 *        - POST `{action:'execute'}` → on-chain digest.
 *   2. On any sponsor error (env not set, network mismatch, server down,
 *      allowlist denied, Enoki out of quota, wallet rejected the signed
 *      bytes, etc.) fall back to plain `useSignAndExecuteTransaction` so
 *      the connected wallet pays gas.
 *
 * Callers don't choose the path — same `execute({ transaction })` signature
 * regardless. The returned `via` field is for observability.
 */
export function useExecuteTransaction(): UseExecuteTransactionResult {
  const account = useCurrentAccount();
  const { network } = useSuiClientContext();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { mutateAsync: signTransaction } = useSignTransaction();

  const execute = useCallback(
    async (input: ExecuteTransactionInput): Promise<ExecuteTransactionResult> => {
      if (!account?.address) {
        throw new Error('Connect a wallet to sign this transaction.');
      }
      const net = network as SuiNetwork;
      const chain = `sui:${net}` as const;

      const sponsorUrl = process.env.NEXT_PUBLIC_SPONSOR_URL?.trim();
      const sponsorable = !!sponsorUrl && (net === 'testnet' || net === 'mainnet');

      if (sponsorable) {
        try {
          const txKindBytes = await input.transaction.build({
            client: suiClient,
            onlyTransactionKind: true,
          });

          const createRes = await fetch(sponsorUrl!, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              network: net,
              transactionKindBytes: toBase64(txKindBytes),
              sender: account.address,
            }),
          });
          if (!createRes.ok) {
            throw new Error(`Sponsor create failed: ${createRes.status}`);
          }
          const { bytes, digest: createdDigest } = (await createRes.json()) as {
            bytes: string;
            digest: string;
          };

          const signed = await signTransaction({
            transaction: Transaction.from(fromBase64(bytes)),
            chain,
          });

          const execRes = await fetch(sponsorUrl!, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              action: 'execute',
              digest: createdDigest,
              signature: signed.signature,
            }),
          });
          if (!execRes.ok) {
            throw new Error(`Sponsor execute failed: ${execRes.status}`);
          }
          const { digest } = (await execRes.json()) as { digest: string };
          return { digest, via: 'sponsor' };
        } catch (sponsorErr) {
          // Wallet rejection of the sponsor-bytes signing prompt is a user
          // choice, not a sponsor outage — surface it as-is instead of
          // silently asking the user to sign again under the wallet-pay
          // path. dApp Kit reports rejections by message; matching on
          // "reject"/"deny"/"cancel" covers Slush + Sui Wallet + Enoki.
          const msg = sponsorErr instanceof Error ? sponsorErr.message.toLowerCase() : '';
          if (/reject|denied|cancel/.test(msg)) {
            throw sponsorErr;
          }
          // Otherwise: fall through to wallet-paid path.
        }
      }

      const result = await signAndExecuteTransaction({
        transaction: input.transaction,
        chain,
      });
      return { digest: result.digest, via: 'wallet' };
    },
    [account?.address, network, suiClient, signTransaction, signAndExecuteTransaction],
  );

  return {
    execute,
    sender: account?.address ?? null,
    network: network as SuiNetwork,
  };
}
