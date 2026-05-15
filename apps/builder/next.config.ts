import type { NextConfig } from 'next';

/**
 * Static export is gated by `NEXT_EXPORT=1` (set by the `builder:export` npm
 * script). Without it, `bun run dev` uses normal SSG/SSR semantics so dynamic
 * routes like `/forms/<id>` resolve at runtime — Next 16 enforces strict
 * `generateStaticParams` matching only when `output: 'export'` is active, and
 * we don't want that pain in dev.
 *
 * The deployed Walrus Site relies on a routes table (see
 * `WALFORM_BUILDER_ROUTES`) to rewrite every dynamic path to its
 * `[id]='_'` placeholder bundle; that's only built when `NEXT_EXPORT=1`.
 */
const EXPORT_MODE = process.env.NEXT_EXPORT === '1';

const nextConfig: NextConfig = {
  ...(EXPORT_MODE ? { output: 'export' as const, trailingSlash: true } : {}),
  images: { unoptimized: true },
  transpilePackages: ['@walform/core'],
  // Walrus SDK ships a Rust→WASM module loaded via `import.meta.url`-relative
  // file reads. Under static export there is no server build, so this shim is
  // moot — kept for hybrid (SSR) configurations.
  serverExternalPackages: ['@mysten/walrus', '@mysten/walrus-wasm'],
};

export default nextConfig;
