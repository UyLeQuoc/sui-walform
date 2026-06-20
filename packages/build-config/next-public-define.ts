import { loadEnv } from 'vite';

/**
 * Every NEXT_PUBLIC_* var the client code reads — mirrors
 * `packages/core/src/env.d.ts`. EVERY key must get a `define` entry: an
 * unset var left out would leave a bare `process.env.X` token in the bundle
 * and throw `process is not defined` in the browser. Keep in sync with env.d.ts.
 */
const NEXT_PUBLIC_KEYS = [
  'NEXT_PUBLIC_DEFAULT_NETWORK',
  'NEXT_PUBLIC_SUI_RPC_TESTNET',
  'NEXT_PUBLIC_SUI_RPC_MAINNET',
  'NEXT_PUBLIC_PACKAGE_ID_TESTNET',
  'NEXT_PUBLIC_PACKAGE_ID_MAINNET',
  'NEXT_PUBLIC_ORIGINAL_PACKAGE_ID_TESTNET',
  'NEXT_PUBLIC_ORIGINAL_PACKAGE_ID_MAINNET',
  'NEXT_PUBLIC_REVIEWERS_PACKAGE_ID_TESTNET',
  'NEXT_PUBLIC_REVIEWERS_PACKAGE_ID_MAINNET',
  'NEXT_PUBLIC_TRANSFER_POLICY_ID_TESTNET',
  'NEXT_PUBLIC_TRANSFER_POLICY_ID_MAINNET',
  'NEXT_PUBLIC_PLATFORM_TREASURY_ID_TESTNET',
  'NEXT_PUBLIC_PLATFORM_TREASURY_ID_MAINNET',
  'NEXT_PUBLIC_PUBLIC_SUBMIT_ALLOWLIST_ID_TESTNET',
  'NEXT_PUBLIC_PUBLIC_SUBMIT_ALLOWLIST_ID_MAINNET',
  'NEXT_PUBLIC_WALRUS_AGGREGATOR_URL_TESTNET',
  'NEXT_PUBLIC_WALRUS_AGGREGATOR_URL_MAINNET',
  'NEXT_PUBLIC_WALRUS_SITE_PACKAGE_ID_TESTNET',
  'NEXT_PUBLIC_WALRUS_SITE_PACKAGE_ID_MAINNET',
  'NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_HOST_TESTNET',
  'NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_HOST_MAINNET',
  'NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_TIP_MAX_MIST_TESTNET',
  'NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_TIP_MAX_MIST_MAINNET',
  'NEXT_PUBLIC_WALRUS_PORTAL_HOST_TESTNET',
  'NEXT_PUBLIC_WALRUS_PORTAL_HOST_MAINNET',
  'NEXT_PUBLIC_SEAL_KEY_SERVERS_TESTNET',
  'NEXT_PUBLIC_SEAL_KEY_SERVERS_MAINNET',
  'NEXT_PUBLIC_SEAL_AGGREGATOR_URL_TESTNET',
  'NEXT_PUBLIC_SEAL_AGGREGATOR_URL_MAINNET',
  'NEXT_PUBLIC_SEAL_API_KEY_NAME_TESTNET',
  'NEXT_PUBLIC_SEAL_API_KEY_NAME_MAINNET',
  'NEXT_PUBLIC_SEAL_API_KEY_TESTNET',
  'NEXT_PUBLIC_SEAL_API_KEY_MAINNET',
  'NEXT_PUBLIC_SEAL_THRESHOLD',
  'NEXT_PUBLIC_ENABLE_SEALED_SCHEMA',
  'NEXT_PUBLIC_ENOKI_PUBLIC_KEY',
  'NEXT_PUBLIC_ENOKI_REDIRECT_URL',
  'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
  'NEXT_PUBLIC_ENABLE_COLLAB',
  'NEXT_PUBLIC_PARTYKIT_HOST',
];

/**
 * Build a Vite `define` map that text-replaces every `process.env.NEXT_PUBLIC_*`
 * (and `process.env.NODE_ENV`) token with a JSON literal at build time, so
 * `@walform/core` keeps reading `process.env.*` without a Node runtime. Both
 * the builder and walform-site vite configs call this with the SAME env dir
 * (apps/builder/.env.local) so the deployed package ids / Seal / Walrus config
 * match. Never defines `process.env` wholesale — that would clobber any library
 * reading `process.env.NODE_ENV`.
 */
export function nextPublicDefine(mode: string, dir: string): Record<string, string> {
  const env = loadEnv(mode, dir, 'NEXT_PUBLIC_');
  const define: Record<string, string> = {};
  const keys = new Set<string>([...NEXT_PUBLIC_KEYS, ...Object.keys(env)]);
  for (const key of keys) {
    if (!key.startsWith('NEXT_PUBLIC_')) continue;
    const val = env[key];
    define[`process.env.${key}`] = val === undefined ? 'undefined' : JSON.stringify(val);
  }
  define['process.env.NODE_ENV'] = JSON.stringify(
    mode === 'production' ? 'production' : 'development',
  );
  return define;
}
