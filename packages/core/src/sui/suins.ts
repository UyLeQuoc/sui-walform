'use client';

import { useMemo } from 'react';
import { useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
import { SuinsClient } from '@mysten/suins';
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

/**
 * SuiNS metadata key the Walrus Sites portal reads when resolving
 * `<name>.wal.app` → on-chain Site object id. Matches `ALLOWED_METADATA.walrusSiteId`
 * shipped by `@mysten/suins`.
 */
export const SUINS_WALRUS_SITE_KEY = 'walrus_site_id';

/**
 * React-side SuinsClient for the active network. Returns `null` on networks
 * SuiNS doesn't support (devnet/localnet) — callers should gate features on
 * this rather than throw.
 *
 * The client is `$extend`-able onto a SuiClient per the SDK convention but
 * we keep the standalone-class form here so we can pass it to tx builders
 * that take `SuinsTransaction` directly.
 */
export function useSuinsClient(): SuinsClient | null {
  const suiClient = useSuiClient();
  const { network } = useSuiClientContext();

  return useMemo(() => {
    if (network !== 'testnet' && network !== 'mainnet') return null;
    return new SuinsClient({
      client: suiClient as unknown as SuiJsonRpcClient,
      network,
    });
  }, [suiClient, network]);
}
