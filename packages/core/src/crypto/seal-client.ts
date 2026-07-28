'use client';

import { useCallback, useMemo } from 'react';
import { EncryptedObject, SealClient, type KeyServerConfig } from '@mysten/seal';
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

function splitIds(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Build the `serverConfigs` list.
 *
 * `raw` = the ACTIVE servers (new ciphertexts are encrypted under these; they
 * get the aggregator URL + API key). `legacyRaw` = servers kept ONLY so older
 * ciphertexts stay decryptable — no aggregator, no key.
 *
 * WHY THE SPLIT — this is not optional bookkeeping: a Seal ciphertext records
 * the key servers it was encrypted under, and decryption fetches shares from
 * exactly those. Swapping the configured server therefore bricks every
 * ciphertext produced before the swap, surfacing as **"Not enough shares.
 * Please fetch more keys."** (0 of threshold-1 shares fetched, because the
 * server the ciphertext names has no entry). Retiring a key server means
 * keeping it here for reads, forever, or re-encrypting the old data.
 *
 * The two lists cannot share one config shape: a committee entry REQUIRES
 * `aggregatorUrl` (all its requests go through the aggregator) while an
 * independent V1 server REJECTS it — the SDK throws "V1 server should not have
 * aggregatorUrl". Same for the API key, which only authenticates the committee.
 */
export function parseKeyServerConfig(
  raw: string | null | undefined,
  aggregatorUrl: string | null | undefined,
  apiKeyName: string | null | undefined,
  apiKey: string | null | undefined,
  legacyRaw?: string | null | undefined,
): KeyServerConfig[] {
  const apiAuth = apiKeyName && apiKey ? { apiKeyName, apiKey } : {};

  const activeIds = splitIds(raw);
  const active: KeyServerConfig[] =
    activeIds.length === 0
      ? [
          {
            objectId: DEFAULT_TESTNET_COMMITTEE_OBJECT_ID,
            weight: 1,
            aggregatorUrl: aggregatorUrl ?? DEFAULT_TESTNET_AGGREGATOR_URL,
            ...apiAuth,
          },
        ]
      : activeIds.map((objectId) => ({
          objectId,
          weight: 1,
          ...(aggregatorUrl ? { aggregatorUrl } : {}),
          ...apiAuth,
        }));

  // Legacy entries are decrypt-only. `weight: 0` would be the honest encoding
  // of "never pick this for new encryption", but the SDK requires weight >= 1,
  // so they carry weight 1 and are simply listed after the active ones.
  const activeSet = new Set(active.map((s) => s.objectId));
  const legacy: KeyServerConfig[] = splitIds(legacyRaw)
    .filter((objectId) => !activeSet.has(objectId))
    .map((objectId) => ({ objectId, weight: 1 }));

  return [...active, ...legacy];
}

export function getSealThreshold(): number {
  const raw = process.env.NEXT_PUBLIC_SEAL_THRESHOLD;
  const n = raw ? Number(raw) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Client for ENCRYPTING (and for decrypting anything it encrypted).
 *
 * Deliberately excludes legacy servers. `seal.encrypt` has no way to target a
 * subset — it binds the ciphertext to EVERY server in `serverConfigs` — so a
 * client that carried the legacy entries would re-bind all new data to the very
 * server we are retiring, and (at threshold 1) let that server alone derive the
 * key. Hence two clients: this one to write, `getSealDecryptClient` to read.
 */
export function getSealClient(
  suiClient: ClientWithCoreApi,
  config: SealNetworkConfig,
): SealClient {
  return buildSealClient(suiClient, config, { includeLegacy: false });
}

/**
 * Client holding ONLY the retired key servers, for reading ciphertexts written
 * before a server swap.
 *
 * It is a separate client rather than extra entries on the main one because a
 * `SealClient` mixing a committee entry (which routes through an aggregator and
 * carries an API key) with a plain V1 entry fails to decrypt EITHER kind —
 * verified on mainnet: the merged client opened legacy ciphertexts but returned
 * "Not enough shares" for committee ones. Each client must stay homogeneous and
 * mirror exactly what some ciphertext was encrypted under.
 */
export function getSealDecryptClient(
  suiClient: ClientWithCoreApi,
  config: SealNetworkConfig,
): SealClient | null {
  const legacy = splitIds(config.legacyKeyServers);
  if (legacy.length === 0) return null;
  return new SealClient({
    suiClient,
    serverConfigs: legacy.map((objectId) => ({ objectId, weight: 1 })),
    verifyKeyServers: false,
    timeout: 10_000,
  });
}

/**
 * Which key servers a ciphertext was encrypted under. Empty when the bytes
 * aren't a Seal envelope at all.
 */
export function ciphertextKeyServers(ciphertext: Uint8Array): string[] {
  try {
    return EncryptedObject.parse(ciphertext).services.map(([objectId]) => objectId);
  } catch {
    return [];
  }
}

function buildSealClient(
  suiClient: ClientWithCoreApi,
  config: SealNetworkConfig,
  { includeLegacy }: { includeLegacy: boolean },
): SealClient {
  const servers = parseKeyServerConfig(
    config.keyServers,
    config.aggregatorUrl,
    config.apiKeyName,
    config.apiKey,
    includeLegacy ? config.legacyKeyServers : null,
  );
  return new SealClient({
    suiClient,
    serverConfigs: servers,
    verifyKeyServers: false,
    timeout: 10_000,
  });
}

/**
 * React-side Seal client for ENCRYPTING, wired to the active network. Returns
 * `null` when the active network is unsupported (devnet/localnet) — callers
 * should gate on this rather than throwing.
 *
 * Decrypt sites want `useSealDecryptClient()` instead. This is the default on
 * purpose: reaching for the wrong one here would silently bind new data to a
 * retired key server, whereas reaching for the wrong one at a decrypt site
 * fails loudly with "Not enough shares".
 */
export function useSealClient(): SealClient | null {
  const suiClient = useSuiGrpcClient();
  const config = useActiveSealConfig();
  return useMemo(() => {
    if (!config) return null;
    return getSealClient(suiClient, config);
  }, [suiClient, config?.keyServers, config?.aggregatorUrl, config?.apiKeyName, config?.apiKey]);
}

/**
 * Resolver that hands back the Seal client matching a given ciphertext.
 *
 * Decryption must go to the exact key servers the ciphertext names, so a single
 * client can't serve a codebase whose data spans a server migration. Pass the
 * ciphertext (the REAL one — resolve any Walrus pointer first) and get the
 * client that can open it, or null when Seal isn't configured for this network.
 *
 * Falls back to the active client for unrecognized servers: that at least
 * produces Seal's own error rather than a silent null.
 */
export function useSealDecryptClient(): (ciphertext: Uint8Array) => SealClient | null {
  const suiClient = useSuiGrpcClient();
  const config = useActiveSealConfig();

  const clients = useMemo(() => {
    if (!config) return null;
    return {
      active: getSealClient(suiClient, config),
      legacy: getSealDecryptClient(suiClient, config),
      legacyIds: new Set(splitIds(config.legacyKeyServers)),
    };
  }, [
    suiClient,
    config?.keyServers,
    config?.legacyKeyServers,
    config?.aggregatorUrl,
    config?.apiKeyName,
    config?.apiKey,
  ]);

  return useCallback(
    (ciphertext: Uint8Array) => {
      if (!clients) return null;
      if (!clients.legacy) return clients.active;
      const servers = ciphertextKeyServers(ciphertext);
      const isLegacy = servers.length > 0 && servers.every((id) => clients.legacyIds.has(id));
      return isLegacy ? clients.legacy : clients.active;
    },
    [clients],
  );
}
