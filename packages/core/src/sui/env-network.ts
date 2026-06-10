'use client';

/**
 * Network-aware env resolvers. The UI switches between testnet and mainnet at
 * runtime via the wallet dropdown; every per-network env var has _TESTNET /
 * _MAINNET pairs in `.env.local`, and these hooks pick the active one based
 * on `useSuiClientContext().network`.
 *
 * Why explicit branches instead of dynamic key lookup: the Vite define
 * helper text-replaces `process.env.NEXT_PUBLIC_X` at build time only when
 * the key is a literal, not a computed expression. Branching by network
 * keeps everything statically inlinable.
 *
 * For non-React call sites that need a Walrus aggregator / portal host, use
 * the matching `getWalrusAggregatorUrl(network)` / `getWalrusPortalHost(network)`
 * exported here — same logic, plain function form.
 */

import { useSuiClientContext } from '@mysten/dapp-kit';

export type WalformNetwork = 'testnet' | 'mainnet';

function asNetwork(net: string): WalformNetwork | null {
  return net === 'testnet' || net === 'mainnet' ? net : null;
}

export function useActiveNetwork(): WalformNetwork | null {
  const { network } = useSuiClientContext();
  return asNetwork(network);
}

// ─── Sui core ids ────────────────────────────────────────────────────────────

export function useActivePackageId(): string | null {
  const net = useActiveNetwork();
  if (net === 'testnet') return process.env.NEXT_PUBLIC_PACKAGE_ID_TESTNET ?? null;
  if (net === 'mainnet') return process.env.NEXT_PUBLIC_PACKAGE_ID_MAINNET ?? null;
  return null;
}

export function useOriginalPackageId(): string | null {
  const net = useActiveNetwork();
  if (net === 'testnet') {
    return (
      process.env.NEXT_PUBLIC_ORIGINAL_PACKAGE_ID_TESTNET ??
      process.env.NEXT_PUBLIC_PACKAGE_ID_TESTNET ??
      null
    );
  }
  if (net === 'mainnet') {
    return (
      process.env.NEXT_PUBLIC_ORIGINAL_PACKAGE_ID_MAINNET ??
      process.env.NEXT_PUBLIC_PACKAGE_ID_MAINNET ??
      null
    );
  }
  return null;
}

/**
 * Package id under which the `reviewers` module's events + object types are
 * tagged. Sui tags every event/struct with the package id where its DEFINING
 * module was FIRST published (its type-origin), NOT the lineage-root original
 * id. On testnet `reviewers` was added in an UPGRADE (package 0x83993865…), so
 * `ReviewersCreated` events live under THAT id — querying under
 * originalPackageId (0x2d8b…) silently matches nothing and the reviewers panel
 * never resolves a tracker. On mainnet `reviewers` shipped in the original
 * publish, so it equals originalPackageId (the fallback below covers that).
 *
 * Set `NEXT_PUBLIC_REVIEWERS_PACKAGE_ID_{TESTNET,MAINNET}` to the type-origin
 * id only when the module was upgrade-added.
 */
export function useReviewersEventPackageId(): string | null {
  const net = useActiveNetwork();
  if (net === 'testnet') {
    return (
      process.env.NEXT_PUBLIC_REVIEWERS_PACKAGE_ID_TESTNET ??
      process.env.NEXT_PUBLIC_ORIGINAL_PACKAGE_ID_TESTNET ??
      process.env.NEXT_PUBLIC_PACKAGE_ID_TESTNET ??
      null
    );
  }
  if (net === 'mainnet') {
    return (
      process.env.NEXT_PUBLIC_REVIEWERS_PACKAGE_ID_MAINNET ??
      process.env.NEXT_PUBLIC_ORIGINAL_PACKAGE_ID_MAINNET ??
      process.env.NEXT_PUBLIC_PACKAGE_ID_MAINNET ??
      null
    );
  }
  return null;
}

export function useActiveTransferPolicyId(): string | null {
  const net = useActiveNetwork();
  if (net === 'testnet') return process.env.NEXT_PUBLIC_TRANSFER_POLICY_ID_TESTNET ?? null;
  if (net === 'mainnet') return process.env.NEXT_PUBLIC_TRANSFER_POLICY_ID_MAINNET ?? null;
  return null;
}

export function useActivePlatformTreasuryId(): string | null {
  const net = useActiveNetwork();
  if (net === 'testnet') return process.env.NEXT_PUBLIC_PLATFORM_TREASURY_ID_TESTNET ?? null;
  if (net === 'mainnet') return process.env.NEXT_PUBLIC_PLATFORM_TREASURY_ID_MAINNET ?? null;
  return null;
}

export function useActivePublicAllowlistId(): string | null {
  const net = useActiveNetwork();
  if (net === 'testnet') return process.env.NEXT_PUBLIC_PUBLIC_SUBMIT_ALLOWLIST_ID_TESTNET ?? null;
  if (net === 'mainnet') return process.env.NEXT_PUBLIC_PUBLIC_SUBMIT_ALLOWLIST_ID_MAINNET ?? null;
  return null;
}

// ─── Walrus ──────────────────────────────────────────────────────────────────

const DEFAULT_WALRUS_AGGREGATOR_TESTNET = 'https://aggregator.walrus-testnet.walrus.space';
const DEFAULT_WALRUS_AGGREGATOR_MAINNET = 'https://aggregator.walrus.space';
const DEFAULT_WALRUS_UPLOAD_RELAY_TESTNET = 'https://upload-relay.testnet.walrus.space';
const DEFAULT_WALRUS_UPLOAD_RELAY_MAINNET = 'https://upload-relay.mainnet.walrus.space';
const DEFAULT_WALRUS_SITE_PACKAGE_TESTNET =
  '0x22b8c1496650eb45fbcca0f8f37fae77ed33b7d4eaab4da5f0bb9b62a8708dcb';

export function getWalrusAggregatorUrl(network: WalformNetwork | string | null | undefined): string {
  if (network === 'mainnet') {
    return process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL_MAINNET || DEFAULT_WALRUS_AGGREGATOR_MAINNET;
  }
  return process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL_TESTNET || DEFAULT_WALRUS_AGGREGATOR_TESTNET;
}

export function getWalrusUploadRelayHost(network: WalformNetwork): string {
  if (network === 'mainnet') {
    return (
      process.env.NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_HOST_MAINNET || DEFAULT_WALRUS_UPLOAD_RELAY_MAINNET
    );
  }
  return (
    process.env.NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_HOST_TESTNET || DEFAULT_WALRUS_UPLOAD_RELAY_TESTNET
  );
}

/**
 * Max tip (in MIST) the wallet will auto-pay to the Walrus upload-relay.
 * Testnet relays are typically free or near-free (~1M MIST); mainnet relays
 * charge based on real storage cost and ask for ~2–5M MIST per upload. The
 * cap is a safety ceiling — the relay's `/v1/tip-config` advertises the
 * actual amount, and the SDK uses min(advertised, max). Override per-network
 * via `NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_TIP_MAX_MIST_{TESTNET,MAINNET}`.
 */
export function getWalrusUploadRelayTipMaxMist(network: WalformNetwork): number {
  const raw =
    network === 'mainnet'
      ? process.env.NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_TIP_MAX_MIST_MAINNET
      : process.env.NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_TIP_MAX_MIST_TESTNET;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  // Defaults: mainnet upload tips run higher (storage cost is real). 50M MIST
  // = 0.05 SUI ceiling — enough headroom for current relay pricing, still
  // bounded so a misconfigured relay can't drain a wallet.
  return network === 'mainnet' ? 50_000_000 : 1_000_000;
}

export function getWalrusSitePackageId(network: WalformNetwork): string | null {
  if (network === 'mainnet') {
    return process.env.NEXT_PUBLIC_WALRUS_SITE_PACKAGE_ID_MAINNET ?? null;
  }
  return (
    process.env.NEXT_PUBLIC_WALRUS_SITE_PACKAGE_ID_TESTNET || DEFAULT_WALRUS_SITE_PACKAGE_TESTNET
  );
}

export function getWalrusPortalHost(network: WalformNetwork): string {
  if (network === 'mainnet') {
    return process.env.NEXT_PUBLIC_WALRUS_PORTAL_HOST_MAINNET || 'wal.app';
  }
  return process.env.NEXT_PUBLIC_WALRUS_PORTAL_HOST_TESTNET || 'localhost:4000';
}

export function useActiveWalrusAggregatorUrl(): string {
  const { network } = useSuiClientContext();
  return getWalrusAggregatorUrl(network);
}

export function useActiveWalrusSitePackageId(): string | null {
  const net = useActiveNetwork();
  if (!net) return null;
  return getWalrusSitePackageId(net);
}

// ─── Seal ────────────────────────────────────────────────────────────────────

const DEFAULT_SEAL_COMMITTEE_TESTNET =
  '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98';
const DEFAULT_SEAL_AGGREGATOR_TESTNET = 'https://seal-aggregator-testnet.mystenlabs.com';

export interface SealNetworkConfig {
  keyServers: string | null;
  aggregatorUrl: string | null;
  /** HTTP header name for the API key (e.g. `x-api-key`). Permissioned
   * (independent) servers require this; decentralized usually do not. */
  apiKeyName: string | null;
  /** API key value sent in the header named by `apiKeyName`. */
  apiKey: string | null;
}

/**
 * Resolve Seal config for a network. Returns null when the network has no
 * configured key servers — avoids silently calling testnet committee from a
 * mainnet client. Testnet has a built-in default committee, so it never
 * returns null.
 *
 * For permissioned mainnet servers (e.g. Ruby Nodes free tier), set both
 * `NEXT_PUBLIC_SEAL_API_KEY_NAME_MAINNET` (header name, typically `x-api-key`)
 * and `NEXT_PUBLIC_SEAL_API_KEY_MAINNET` (the key). The Seal SDK rejects a
 * partial pair, so either provide both or neither.
 */
export function getSealConfig(network: WalformNetwork): SealNetworkConfig | null {
  if (network === 'mainnet') {
    const keyServers = process.env.NEXT_PUBLIC_SEAL_KEY_SERVERS_MAINNET;
    if (!keyServers || keyServers.trim() === '') return null;
    return {
      keyServers,
      aggregatorUrl: process.env.NEXT_PUBLIC_SEAL_AGGREGATOR_URL_MAINNET ?? null,
      apiKeyName: process.env.NEXT_PUBLIC_SEAL_API_KEY_NAME_MAINNET ?? null,
      apiKey: process.env.NEXT_PUBLIC_SEAL_API_KEY_MAINNET ?? null,
    };
  }
  // Testnet: respect explicit env config when set. Only fall back to Mysten's
  // committee defaults when keyServers is fully empty — otherwise the SDK
  // throws "V1 server should not have aggregatorUrl" because an independent
  // server (e.g. Overclock open-mode) was paired with the committee aggregator.
  const testnetKeyServers = process.env.NEXT_PUBLIC_SEAL_KEY_SERVERS_TESTNET;
  if (testnetKeyServers && testnetKeyServers.trim() !== '') {
    return {
      keyServers: testnetKeyServers,
      aggregatorUrl: process.env.NEXT_PUBLIC_SEAL_AGGREGATOR_URL_TESTNET ?? null,
      apiKeyName: process.env.NEXT_PUBLIC_SEAL_API_KEY_NAME_TESTNET ?? null,
      apiKey: process.env.NEXT_PUBLIC_SEAL_API_KEY_TESTNET ?? null,
    };
  }
  return {
    keyServers: DEFAULT_SEAL_COMMITTEE_TESTNET,
    aggregatorUrl: DEFAULT_SEAL_AGGREGATOR_TESTNET,
    apiKeyName: null,
    apiKey: null,
  };
}

export function useActiveSealConfig(): SealNetworkConfig | null {
  const net = useActiveNetwork();
  return net ? getSealConfig(net) : null;
}
