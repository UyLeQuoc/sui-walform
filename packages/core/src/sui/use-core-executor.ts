'use client';

import { useCallback } from 'react';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { useSuiGrpcClient } from './grpc/use-grpc-client';

export interface CoreExecuteInput {
  bytes: string;
  signature: string;
}

export interface CoreExecuteResult {
  digest: string;
  rawEffects: number[];
  effects: string;
  bytes: string;
  signature: string;
}

/**
 * Broadcast handler for dApp Kit's `useSignAndExecuteTransaction({ execute })`.
 *
 * MUST be passed at EVERY `useSignAndExecuteTransaction` call site. dApp Kit's
 * built-in default calls `client.executeTransactionBlock` — a JSON-RPC method
 * name that the gRPC client doesn't have and that the network no longer serves
 * (testnet already 404s, mainnet off 2026-07-31). Omitting it doesn't fail at
 * build time; it throws at the moment a user signs, which is the worst place to
 * find out.
 *
 * The return shape is dApp Kit's contract: the digest plus BCS effects in both
 * byte-array and base64 form, which wallets use to render what the tx did
 * without re-fetching it.
 */
export function useCoreTransactionExecutor(): (
  input: CoreExecuteInput,
) => Promise<CoreExecuteResult> {
  const client = useSuiGrpcClient();

  return useCallback(
    async ({ bytes, signature }: CoreExecuteInput): Promise<CoreExecuteResult> => {
      const result = await client.core.executeTransaction({
        transaction: fromBase64(bytes),
        signatures: [signature],
        include: { effects: true },
      });
      // A tx that executed but reverted comes back under `FailedTransaction`;
      // it still has a digest and effects, and callers surface the on-chain
      // error from those rather than from a thrown exception here.
      const tx = result.Transaction ?? result.FailedTransaction;
      const effectsBcs = tx?.effects?.bcs ?? null;
      return {
        digest: tx?.digest ?? '',
        rawEffects: effectsBcs ? Array.from(effectsBcs) : [],
        effects: effectsBcs ? toBase64(effectsBcs) : '',
        bytes,
        signature,
      };
    },
    [client],
  );
}
