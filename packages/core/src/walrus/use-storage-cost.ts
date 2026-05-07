'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
import { WalrusClient } from '@mysten/walrus';

/**
 * Browser-side estimate of Walrus storage cost. Used by Publish to show
 * creators what their cover image will cost in WAL before they commit.
 *
 * `walrusClient.storageCost(size, epochs)` reads system-wide pricing from
 * the Walrus system object on Sui — no signer required, just a SuiClient.
 * The WASM module is bundled in the browser build so this works without
 * the server-side `serverExternalPackages` shim that the upload route uses.
 *
 * Returns `null` when sizeBytes <= 0 (no input yet).
 */
export interface StorageCostEstimate {
  /** Cost of reserving storage for `epochs` (in FROST = 1e-9 WAL). */
  storageCost: bigint;
  /** Cost of the write (encoding + storage-node fan-out, also in FROST). */
  writeCost: bigint;
  /** storageCost + writeCost. */
  totalCost: bigint;
}

export interface UseStorageCostResult {
  cost: StorageCostEstimate | null;
  isLoading: boolean;
  error: Error | null;
}

export function useStorageCost(sizeBytes: number, epochs: number = 5): UseStorageCostResult {
  const suiClient = useSuiClient();
  const { network } = useSuiClientContext();

  // The Walrus SDK only knows about testnet/mainnet; if the user is on devnet
  // we skip the query and return null. (Walrus has no devnet.)
  const walrusNetwork =
    network === 'mainnet' ? 'mainnet' : network === 'testnet' ? 'testnet' : null;

  // One client per (network, suiClient). suiClient is stable across renders
  // for a given network, so this only re-instantiates on real switch.
  const client = useMemo(() => {
    if (!walrusNetwork) return null;
    return new WalrusClient({ network: walrusNetwork, suiClient });
  }, [walrusNetwork, suiClient]);

  const enabled = !!client && sizeBytes > 0 && epochs > 0;

  const query = useQuery<StorageCostEstimate>({
    queryKey: ['walform:walrus-storage-cost', walrusNetwork, sizeBytes, epochs],
    queryFn: async () => {
      if (!client) throw new Error('Walrus client not available on this network');
      const cost = await client.storageCost(sizeBytes, epochs);
      return cost;
    },
    enabled,
    staleTime: 5 * 60_000,
  });

  return {
    cost: query.data ?? null,
    isLoading: enabled && query.isPending,
    error: (query.error as Error | null) ?? null,
  };
}

/**
 * Format a FROST amount as a WAL string with up to 9 decimal digits, trailing
 * zeros trimmed. 1 WAL = 1e9 FROST.
 */
export function formatWal(frost: bigint): string {
  if (frost === 0n) return '0';
  const whole = frost / 1_000_000_000n;
  const frac = frost % 1_000_000_000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fracStr}`;
}
