'use client';

import { SealClient, type KeyServerConfig } from '@mysten/seal';
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

/**
 * Default Seal testnet setup: Mysten's decentralized committee key server
 * exposed through its hosted aggregator. The committee runs an internal
 * MPC threshold (2-of-N) server-side, so the SDK uses a single serverConfigs
 * entry with `threshold: 1` — the committee itself handles quorum.
 *
 * Swap to 3 individual key servers + `threshold: 2` by setting
 * `NEXT_PUBLIC_SEAL_KEY_SERVERS` to a comma-separated list of objectIds and
 * bumping `NEXT_PUBLIC_SEAL_THRESHOLD=2`. Mysten's aggregator URL stays
 * relevant only in committee mode.
 */
export const DEFAULT_TESTNET_COMMITTEE_OBJECT_ID =
  '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98';
export const DEFAULT_TESTNET_AGGREGATOR_URL = 'https://seal-aggregator-testnet.mystenlabs.com';

export function parseKeyServerConfig(
  raw: string | undefined,
  aggregatorUrl: string | undefined,
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

export function getSealClient(suiClient: SuiJsonRpcClient): SealClient {
  const servers = parseKeyServerConfig(
    process.env.NEXT_PUBLIC_SEAL_KEY_SERVERS,
    process.env.NEXT_PUBLIC_SEAL_AGGREGATOR_URL,
  );
  return new SealClient({
    suiClient,
    serverConfigs: servers,
    verifyKeyServers: false,
    timeout: 10_000,
  });
}
