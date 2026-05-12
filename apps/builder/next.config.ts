import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@walform/core'],
  // Walrus SDK ships a Rust→WASM module loaded via `import.meta.url`-relative
  // file reads. Turbopack rewrites those paths to a `/ROOT/...` placeholder
  // which then ENOENTs at runtime. Marking these as external tells Next to
  // leave them in node_modules and resolve them via the standard Node
  // `require` path, which honors Bun's hashed `.bun/` directory layout.
  serverExternalPackages: ['@mysten/walrus', '@mysten/walrus-wasm'],
};

export default nextConfig;
