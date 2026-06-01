/**
 * Env shim — declares the NEXT_PUBLIC_* env vars we read in `@walform/core`
 * so TypeScript doesn't require `@types/node` on a client library. At build
 * time the Vite config (`packages/build-config/next-public-define.ts`) text-
 * replaces every `process.env.NEXT_PUBLIC_X` token with its JSON literal via
 * `define`, so no `process` global is referenced at runtime. WalForm has no
 * server-side signing or sponsorship — every Sui tx is signed and paid by
 * the user's connected wallet.
 *
 * Network model: the UI switches between testnet and mainnet at runtime via
 * the wallet dropdown. Every per-network resource has _TESTNET / _MAINNET
 * pairs — resolver hooks in `sui/env-network.ts` pick the active one based
 * on `useSuiClientContext().network`.
 */
declare module '*.css';
declare module '@fontsource-variable/*';

declare const process: {
  env: {
    NEXT_PUBLIC_DEFAULT_NETWORK?: 'testnet' | 'mainnet';

    // Sui core ids — per-network
    NEXT_PUBLIC_PACKAGE_ID_TESTNET?: string;
    NEXT_PUBLIC_PACKAGE_ID_MAINNET?: string;
    NEXT_PUBLIC_ORIGINAL_PACKAGE_ID_TESTNET?: string;
    NEXT_PUBLIC_ORIGINAL_PACKAGE_ID_MAINNET?: string;
    NEXT_PUBLIC_TRANSFER_POLICY_ID_TESTNET?: string;
    NEXT_PUBLIC_TRANSFER_POLICY_ID_MAINNET?: string;
    NEXT_PUBLIC_PLATFORM_TREASURY_ID_TESTNET?: string;
    NEXT_PUBLIC_PLATFORM_TREASURY_ID_MAINNET?: string;
    NEXT_PUBLIC_PUBLIC_SUBMIT_ALLOWLIST_ID_TESTNET?: string;
    NEXT_PUBLIC_PUBLIC_SUBMIT_ALLOWLIST_ID_MAINNET?: string;

    // Walrus — per-network
    NEXT_PUBLIC_WALRUS_AGGREGATOR_URL_TESTNET?: string;
    NEXT_PUBLIC_WALRUS_AGGREGATOR_URL_MAINNET?: string;
    NEXT_PUBLIC_WALRUS_SITE_PACKAGE_ID_TESTNET?: string;
    NEXT_PUBLIC_WALRUS_SITE_PACKAGE_ID_MAINNET?: string;
    NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_HOST_TESTNET?: string;
    NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_HOST_MAINNET?: string;
    NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_TIP_MAX_MIST_TESTNET?: string;
    NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_TIP_MAX_MIST_MAINNET?: string;
    NEXT_PUBLIC_WALRUS_PORTAL_HOST_TESTNET?: string;
    NEXT_PUBLIC_WALRUS_PORTAL_HOST_MAINNET?: string;

    // Seal — per-network
    NEXT_PUBLIC_SEAL_KEY_SERVERS_TESTNET?: string;
    NEXT_PUBLIC_SEAL_KEY_SERVERS_MAINNET?: string;
    NEXT_PUBLIC_SEAL_AGGREGATOR_URL_TESTNET?: string;
    NEXT_PUBLIC_SEAL_AGGREGATOR_URL_MAINNET?: string;
    NEXT_PUBLIC_SEAL_API_KEY_NAME_TESTNET?: string;
    NEXT_PUBLIC_SEAL_API_KEY_NAME_MAINNET?: string;
    NEXT_PUBLIC_SEAL_API_KEY_TESTNET?: string;
    NEXT_PUBLIC_SEAL_API_KEY_MAINNET?: string;

    // Network-neutral
    NEXT_PUBLIC_SEAL_THRESHOLD?: string;
    NEXT_PUBLIC_ENABLE_SEALED_SCHEMA?: string;
    NEXT_PUBLIC_ENOKI_PUBLIC_KEY?: string;
    NEXT_PUBLIC_ENOKI_REDIRECT_URL?: string;
    NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string;
    [key: string]: string | undefined;
  };
};
