import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nextPublicDefine } from '../../packages/build-config/next-public-define';

const appDir = fileURLToPath(new URL('.', import.meta.url));
const coreSrc = fileURLToPath(new URL('../../packages/core/src', import.meta.url));

// Static SPA for Walrus Sites. Output stays at out/ (deploy scripts +
// public/ws-resources.json reference it). Env: process.env.NEXT_PUBLIC_* tokens
// are text-replaced by the shared define helper so @walform/core stays
// bundler-agnostic. WASM (walrus) needs wasm + top-level-await; the walrus
// packages are excluded from esbuild pre-bundling so wasm-bindgen's
// import.meta.url resolution survives.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait()],
  define: nextPublicDefine(mode, appDir),
  resolve: {
    alias: [
      { find: /^@walform\/core\/(.*)$/, replacement: `${coreSrc}/$1` },
      { find: /^@walform\/core$/, replacement: `${coreSrc}/index.ts` },
      { find: /^@\/(.*)$/, replacement: `${appDir}src/$1` },
    ],
    dedupe: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', '@mysten/dapp-kit'],
  },
  optimizeDeps: {
    exclude: ['@mysten/walrus', '@mysten/walrus-wasm'],
    // @mysten/walrus is raw-served (above) so its wasm-bindgen import.meta.url
    // resolves in dev — but its object-loader imports the CJS `dataloader` as a
    // default import, which only gets a proper ESM `default` interop once Vite
    // pre-bundles it. `dataloader` is a transitive dep (nested under walrus, not
    // a direct builder dep), so use Vite's `parent > child` include syntax.
    include: ['@mysten/walrus > dataloader'],
  },
  build: {
    target: 'esnext',
    outDir: 'out',
    emptyOutDir: true,
    rollupOptions: {
      onwarn(warning, warn) {
        // Core files carry RSC 'use client' pragmas — no-ops in a Vite SPA.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
  server: { port: 3000 },
  preview: { port: 3000 },
}));
