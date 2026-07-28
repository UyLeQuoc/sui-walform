'use client';

import { useMemo } from 'react';
import { SealClient, type KeyServerConfig } from '@mysten/seal';
import type { ClientWithCoreApi } from '@mysten/sui/client';
import { useSuiGrpcClient } from '../sui/grpc/use-grpc-client';
import { useActiveSealConfig, type SealNetworkConfig } from '../sui/env-network';

/**
 * Seal client factory.
 *
 * Both networks are pointed at Mysten's decentralized **committee** key server
 * behind a hosted aggregator (testnet 3-of-5, mainnet 5-of-8). The committee
 * runs the MPC server-side, so the SDK sees ONE `serverConfigs` entry and
 * `threshold: 1` — that 1 is "one aggregator response", not the committee's
 * own N-of-M. Only bump `NEXT_PUBLIC_SEAL_THRESHOLD` if you list several
 * INDEPENDENT servers in `NEXT_PUBLIC_SEAL_KEY_SERVERS_*`.
 *
 * **Mainnet requires credentials**: the committee aggregator rejects
 * unauthenticated calls. The key comes from the Enoki dashboard (request Seal
 * key server access) and the header name is always `X-API-Key` — set both
 * `NEXT_PUBLIC_SEAL_API_KEY_NAME_MAINNET` and `NEXT_PUBLIC_SEAL_API_KEY_MAINNET`.
 * The SDK rejects a half-set pair, so provide both or neither. Independent
 * permissioned servers (Ruby Nodes, Studio Mirai, …) use the same two vars with
 * whatever header that provider specifies.
 *
 * Note the URL is NOT configured anywhere for independent servers: the on-chain
 * KeyServer object is the source of truth and holds the current URL. Only the
 * committee needs `aggregatorUrl`.
 */
const DEFAULT_TESTNET_COMMITTEE_OBJECT_ID =
  '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98';
const DEFAULT_TESTNET_AGGREGATOR_URL = 'https://seal-aggregator-testnet.mystenlabs.com';

export function parseKeyServerConfig(
  raw: string | null | undefined,
  aggregatorUrl: string | null | undefined,
  apiKeyName: string | null | undefined,
  apiKey: string | null | undefined,
): KeyServerConfig[] {
  const apiAuth = apiKeyName && apiKey ? { apiKeyName, apiKey } : {};

  if (!raw || raw.trim() === '') {
    return [
      {
        objectId: DEFAULT_TESTNET_COMMITTEE_OBJECT_ID,
        weight: 1,
        aggregatorUrl: aggregatorUrl ?? DEFAULT_TESTNET_AGGREGATOR_URL,
        ...apiAuth,
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
      ...apiAuth,
    }));
}

export function getSealThreshold(): number {
  const raw = process.env.NEXT_PUBLIC_SEAL_THRESHOLD;
  const n = raw ? Number(raw) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function getSealClient(
  suiClient: ClientWithCoreApi,
  config: SealNetworkConfig,
): SealClient {
  const servers = parseKeyServerConfig(
    config.keyServers,
    config.aggregatorUrl,
    config.apiKeyName,
    config.apiKey,
  );
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
  const suiClient = useSuiGrpcClient();
  const config = useActiveSealConfig();
  return useMemo(() => {
    if (!config) return null;
    return getSealClient(suiClient, config);
  }, [suiClient, config?.keyServers, config?.aggregatorUrl, config?.apiKeyName, config?.apiKey]);
}
