import type { NextConfig } from 'next';

/**
 * Static export is the default — every route is now flat (`/forms/edit`,
 * `/forms/results`, `/forms/preview`, `/f`) and reads its id from the
 * `?formId=…` query string client-side, so SSG has no dynamic slug
 * placeholders to enumerate.
 */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@walform/core'],
  // Walrus SDK ships a Rust→WASM module loaded via `import.meta.url`-relative
  // file reads. Under static export there is no server build, so this shim is
  // moot — kept for hybrid (SSR) configurations.
  serverExternalPackages: ['@mysten/walrus', '@mysten/walrus-wasm'],
};

export default nextConfig;
