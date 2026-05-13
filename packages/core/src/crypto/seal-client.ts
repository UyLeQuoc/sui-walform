'use client';

import { useMemo } from 'react';
import { SealClient, type KeyServerConfig } from '@mysten/seal';
import { useSuiClient } from '@mysten/dapp-kit';
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { useActiveSealConfig, type SealNetworkConfig } from '../sui/env-network';

/**
 * Seal client factory. The default for testnet is Mysten's decentralized
 * committee key server exposed through a hosted aggregator — the committee
 * itself handles 2-of-N MPC server-side, so we pass a single serverConfigs
 * entry with `threshold: 1`. Override per-network via
 * `NEXT_PUBLIC_SEAL_KEY_SERVERS_{TESTNET,MAINNET}` (comma-separated objectIds)
 * and bump `NEXT_PUBLIC_SEAL_THRESHOLD=2`.
 */
const DEFAULT_TESTNET_COMMITTEE_OBJECT_ID =
  '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98';
const DEFAULT_TESTNET_AGGREGATOR_URL = 'https://seal-aggregator-testnet.mystenlabs.com';

export function parseKeyServerConfig(
  raw: string | null | undefined,
  aggregatorUrl: string | null | undefined,
): KeyServerConfig[] {
  if (!raw || raw.trim() === '') {
    return [
      {
        objectId: DEFAULT_TESTNET_COMMITTEE_OBJECT_ID,
        weight: 1,
        aggregatorUrl: aggregatorUrl ?? DEFAULT_TESTNET_AGGREGATOR_URL,
      },
    ];
  }
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((objectId) => ({
      objectId,
      weight: 1,
      ...(aggregatorUrl ? { aggregatorUrl } : {}),
    }));
}

export function getSealThreshold(): number {
  const raw = process.env.NEXT_PUBLIC_SEAL_THRESHOLD;
  const n = raw ? Number(raw) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function getSealClient(
  suiClient: SuiJsonRpcClient,
  config: SealNetworkConfig,
): SealClient {
  const servers = parseKeyServerConfig(config.keyServers, config.aggregatorUrl);
  return new SealClient({
    suiClient,
    serverConfigs: servers,
    verifyKeyServers: false,
    timeout: 10_000,
  });
}

/**
 * React-side Seal client wired to the active network. Returns `null` when the
 * active network is unsupported (devnet/localnet) — callers should gate on
 * this rather than throwing.
 */
export function useSealClient(): SealClient | null {
  const suiClient = useSuiClient();
  const config = useActiveSealConfig();
  return useMemo(() => {
    if (!config) return null;
    return getSealClient(suiClient as SuiJsonRpcClient, config);
  }, [suiClient, config?.keyServers, config?.aggregatorUrl]);
}
