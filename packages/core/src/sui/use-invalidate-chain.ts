'use client';

import { useCallback } from 'react';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { useQueryClient } from '@tanstack/react-query';
import { useSuiGrpcClient } from './grpc/use-grpc-client';

/**
 * Hook: after any on-chain mutation, call the returned function with the tx
 * digest to wait for finality and then invalidate every chain query for the
 * active network so `useOnChainForms` / `useFormSubmissions` etc. re-fetch
 * fresh state.
 *
 * Every chain query key in this app starts with the network name — the
 * convention dApp Kit set (`[network, method, params]`) and the one the
 * hand-rolled gRPC/GraphQL queries follow — so invalidating `[network]` covers
 * all of them.
 */
export function useInvalidateChainQueries() {
  const { network } = useSuiClientContext();
  const suiClient = useSuiGrpcClient();
  const queryClient = useQueryClient();

  return useCallback(
    async (digest?: string) => {
      if (digest) {
        try {
          await suiClient.core.waitForTransaction({ digest });
        } catch {
          // Best-effort: invalidate anyway so UI catches up once the digest
          // lands in a later poll.
        }
      }
      await queryClient.invalidateQueries({ queryKey: [network] });
    },
    [network, suiClient, queryClient],
  );
}
