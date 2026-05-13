'use client';

/**
 * Network-aware env resolvers. The UI switches between testnet and mainnet at
 * runtime via the wallet dropdown; every per-network env var has _TESTNET /
 * _MAINNET pairs in `.env.local`, and these hooks pick the active one based
 * on `useSuiClientContext().network`.
 *
 * Why explicit branches instead of dynamic key lookup: Next.js inlines
 * `process.env.NEXT_PUBLIC_X` at build time only when the key is a literal,
 * not a computed expression. Branching by network keeps everything inlined.
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
}

export function getSealConfig(network: WalformNetwork): SealNetworkConfig {
  if (network === 'mainnet') {
    return {
      keyServers: process.env.NEXT_PUBLIC_SEAL_KEY_SERVERS_MAINNET ?? null,
      aggregatorUrl: process.env.NEXT_PUBLIC_SEAL_AGGREGATOR_URL_MAINNET ?? null,
    };
  }
  return {
    keyServers: process.env.NEXT_PUBLIC_SEAL_KEY_SERVERS_TESTNET || DEFAULT_SEAL_COMMITTEE_TESTNET,
    aggregatorUrl:
      process.env.NEXT_PUBLIC_SEAL_AGGREGATOR_URL_TESTNET || DEFAULT_SEAL_AGGREGATOR_TESTNET,
  };
}

export function useActiveSealConfig(): SealNetworkConfig | null {
  const net = useActiveNetwork();
  return net ? getSealConfig(net) : null;
}
