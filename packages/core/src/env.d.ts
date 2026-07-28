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

    // Optional Sui gRPC override — object/tx/balance reads. Falls back to the
    // official fullnode (`https://fullnode.<net>.sui.io`) when unset; point it
    // at a dedicated endpoint to avoid the public node's rate limits.
    NEXT_PUBLIC_SUI_GRPC_TESTNET?: string;
    NEXT_PUBLIC_SUI_GRPC_MAINNET?: string;

    // Sui GraphQL endpoint — event + transaction-history scans only (gRPC has
    // neither). MUST be a FULL-HISTORY indexer: the official GraphQL prunes to
    // a rolling window (measured 2026-07-28: 155 of 247 SubmissionCreated
    // events), which silently hides older submissions, templates and listings.
    NEXT_PUBLIC_SUI_GRAPHQL_TESTNET?: string;
    NEXT_PUBLIC_SUI_GRAPHQL_MAINNET?: string;

    // Sui core ids — per-network
    NEXT_PUBLIC_PACKAGE_ID_TESTNET?: string;
    NEXT_PUBLIC_PACKAGE_ID_MAINNET?: string;
    NEXT_PUBLIC_ORIGINAL_PACKAGE_ID_TESTNET?: string;
    NEXT_PUBLIC_ORIGINAL_PACKAGE_ID_MAINNET?: string;
    // Type-origin package id of the `reviewers` module (where its events are
    // tagged). Set only when reviewers was added via UPGRADE (testnet); falls
    // back to the original package id otherwise (mainnet).
    NEXT_PUBLIC_REVIEWERS_PACKAGE_ID_TESTNET?: string;
    NEXT_PUBLIC_REVIEWERS_PACKAGE_ID_MAINNET?: string;
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
    // Retired key servers, kept ONLY so ciphertexts encrypted under them still
    // decrypt. A Seal ciphertext names its key servers, so removing one without
    // listing it here breaks every ciphertext it produced ("Not enough shares").
    NEXT_PUBLIC_SEAL_LEGACY_KEY_SERVERS_TESTNET?: string;
    NEXT_PUBLIC_SEAL_LEGACY_KEY_SERVERS_MAINNET?: string;
    NEXT_PUBLIC_SEAL_AGGREGATOR_URL_TESTNET?: string;
    NEXT_PUBLIC_SEAL_AGGREGATOR_URL_MAINNET?: string;
    NEXT_PUBLIC_SEAL_API_KEY_NAME_TESTNET?: string;
    NEXT_PUBLIC_SEAL_API_KEY_NAME_MAINNET?: string;
    NEXT_PUBLIC_SEAL_API_KEY_TESTNET?: string;
    NEXT_PUBLIC_SEAL_API_KEY_MAINNET?: string;

    // Network-neutral
    NEXT_PUBLIC_SEAL_THRESHOLD?: string;
    NEXT_PUBLIC_ENABLE_SEALED_SCHEMA?: string;

    // Realtime collaboration (PartyKit). The Yjs doc is hosted + persisted by a
    // PartyKit server (one room per formId); networking turns on when both the
    // enable flag and the PartyKit host are set, otherwise collab stays local
    // (IndexedDB-only). Access is gated by a share token in the invite link.
    // Dev host: 127.0.0.1:1999; prod: walform-collab.<account>.partykit.dev.
    NEXT_PUBLIC_ENABLE_COLLAB?: string;
    NEXT_PUBLIC_PARTYKIT_HOST?: string;
    NEXT_PUBLIC_ENOKI_PUBLIC_KEY?: string;
    NEXT_PUBLIC_ENOKI_REDIRECT_URL?: string;
    NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string;
    [key: string]: string | undefined;
  };
};
