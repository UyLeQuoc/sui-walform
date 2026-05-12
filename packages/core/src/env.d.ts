/**
 * Env shim — declares the NEXT_PUBLIC_* env vars we read in `@walform/core`
 * so TypeScript doesn't require `@types/node` on a client library. At runtime
 * Next.js inlines `process.env.NEXT_PUBLIC_X` at build time. WalForm has no
 * server-side signing or sponsorship — every Sui tx is signed and paid by
 * the user's connected wallet.
 */
declare const process: {
  env: {
    NEXT_PUBLIC_SUI_NETWORK?: 'testnet' | 'mainnet' | 'devnet';
    NEXT_PUBLIC_WALRUS_NETWORK?: string;
    NEXT_PUBLIC_PACKAGE_ID?: string;
    NEXT_PUBLIC_PACKAGE_ID_MAINNET?: string;
    NEXT_PUBLIC_PORTAL_DOMAIN?: string;
    NEXT_PUBLIC_ENOKI_PUBLIC_KEY?: string;
    NEXT_PUBLIC_ENOKI_REDIRECT_URL?: string;
    NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string;
    NEXT_PUBLIC_SEAL_KEY_SERVERS?: string;
    NEXT_PUBLIC_SEAL_AGGREGATOR_URL?: string;
    NEXT_PUBLIC_SEAL_THRESHOLD?: string;
    NEXT_PUBLIC_PUBLIC_SUBMIT_ALLOWLIST_ID?: string;
    NEXT_PUBLIC_ENABLE_SEALED_SCHEMA?: string;
    NEXT_PUBLIC_BUILDER_ORIGIN?: string;
    [key: string]: string | undefined;
  };
};
