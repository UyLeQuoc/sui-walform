'use client';

import { useCallback } from 'react';
import { useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook: after any on-chain mutation, call the returned function with the tx
 * digest to wait for finality and then invalidate every dApp Kit query for
 * the active network so `useOnChainForms` / `useFormSubmissions` etc.
 * re-fetch fresh state.
 *
 * Query keys in dapp-kit are `[network, method, params, ...]`; invalidating
 * `[network]` covers every hook that reads from chain.
 */
export function useInvalidateChainQueries() {
  const { network } = useSuiClientContext();
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();

  return useCallback(
    async (digest?: string) => {
      if (digest) {
        try {
          await suiClient.waitForTransaction({ digest });
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
