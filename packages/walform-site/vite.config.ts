import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nextPublicDefine } from '../build-config/next-public-define';

const coreSrc = fileURLToPath(new URL('../core/src', import.meta.url));
// Reuse the builder's .env.local so deployed package ids / Seal / Walrus config
// match between the builder and the Mode B shell.
const builderEnvDir = fileURLToPath(new URL('../../apps/builder', import.meta.url));

// Mode B static shell — a single hash/config-routed view mounting
// FormSubmissionView. The submit path never constructs a WalrusClient, so no
// wasm plugin is needed (unlike the builder). base './' keeps asset URLs
// relative so the bundle works from any Walrus sub-path.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss()],
  define: nextPublicDefine(mode, builderEnvDir),
  resolve: {
    alias: [
      { find: /^@walform\/core\/(.*)$/, replacement: `${coreSrc}/$1` },
      { find: /^@walform\/core$/, replacement: `${coreSrc}/index.ts` },
    ],
    dedupe: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', '@mysten/dapp-kit'],
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
  server: { port: 3002 },
  preview: { port: 3002 },
}));
