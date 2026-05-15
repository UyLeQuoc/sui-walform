#!/usr/bin/env bun
/**
 * Mirror the builder's static export `out/` into `public/walform-builder-bundle/`
 * with an `index.json` manifest. Lets the browser-side "Deploy builder"
 * button fetch every file from same-origin (so SHA-256 + Walrus upload work
 * without CORS gymnastics) and push them to a single Walrus Site under one
 * SuiNS name.
 *
 * Workflow (single command):
 *   bun run builder:export   # = rm bundle → next build → this script
 *
 * Manual:
 *   bun run build            # next build → out/
 *   bun run bundle:mirror    # this script → public/walform-builder-bundle/
 *
 * The pre-rm step in `builder:export` is essential — without it, a second
 * `next build` re-copies the previous bundle from public/ into the new
 * out/, causing recursive growth on every iteration.
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = process.env.BUILDER_OUT_DIR ?? 'out';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const BUNDLE_TARGET = resolve(SCRIPT_DIR, '..', 'public', 'walform-builder-bundle');

interface IndexEntry {
  path: string;
  contentType: string;
  sizeBytes: number;
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir);
  for (const name of entries) {
    const p = join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) {
      yield* walk(p);
    } else if (s.isFile()) {
      yield p;
    }
  }
}

function contentTypeFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.html')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'application/javascript';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.woff')) return 'font/woff';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  if (lower.endsWith('.txt')) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

async function copyFile(src: string, dst: string): Promise<void> {
  await mkdir(dirname(dst), { recursive: true });
  const bytes = await readFile(src);
  await writeFile(dst, bytes);
}

async function main(): Promise<void> {
  const outAbs = resolve(SCRIPT_DIR, '..', OUT_DIR);
  const outStat = await stat(outAbs).catch(() => null);
  if (!outStat?.isDirectory()) {
    console.error(`[mirror-builder] ${outAbs} not found. Run \`next build\` first.`);
    process.exit(1);
  }

  if (existsSync(BUNDLE_TARGET)) {
    await rm(BUNDLE_TARGET, { recursive: true, force: true });
  }
  await mkdir(BUNDLE_TARGET, { recursive: true });

  const filePaths: string[] = [];
  for await (const p of walk(outAbs)) filePaths.push(p);
  console.info(`[mirror-builder] mirroring ${filePaths.length} files…`);

  const index: IndexEntry[] = [];
  for (const file of filePaths) {
    const relPath = relative(outAbs, file).split(sep).join('/');
    const sitePath = '/' + relPath;
    const dst = join(BUNDLE_TARGET, relPath);
    await copyFile(file, dst);
    const s = await stat(file);
    index.push({
      path: sitePath,
      contentType: contentTypeFor(file),
      sizeBytes: s.size,
    });
  }

  const indexPath = join(BUNDLE_TARGET, 'index.json');
  await writeFile(
    indexPath,
    JSON.stringify(
      {
        bundledAt: new Date().toISOString(),
        files: index,
      },
      null,
      2,
    ),
  );
  console.info(
    `[mirror-builder] wrote ${BUNDLE_TARGET} + index.json (${index.length} files)`,
  );
}

main().catch((err) => {
  console.error('[mirror-builder] fatal:', err);
  process.exit(1);
});
