#!/usr/bin/env bun
/**
 * Mirror the static export at `out/` into `apps/builder/public/walform-site-bundle/`
 * and write a lightweight `index.json` listing every file with its content
 * type. The browser-side Deploy button reads the index, fetches each file
 * via the same origin, and uploads to Walrus from the user's wallet.
 *
 * No Walrus calls here — that's the point of the pivot. Each form deploy
 * does its own browser-side upload.
 *
 *   bun run build            # next build → out/
 *   bun run bundle:mirror    # this script → /public/walform-site-bundle/
 */

import { existsSync } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = process.env.WALFORM_SITE_OUT_DIR ?? "out";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const BUNDLE_TARGET = resolve(
  SCRIPT_DIR,
  "..",
  "..",
  "..",
  "apps",
  "builder",
  "public",
  "walform-site-bundle",
);

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
  if (lower.endsWith(".html")) return "text/html; charset=utf-8";
  if (lower.endsWith(".css")) return "text/css; charset=utf-8";
  if (lower.endsWith(".js") || lower.endsWith(".mjs"))
    return "application/javascript";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  if (lower.endsWith(".woff2")) return "font/woff2";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".ttf")) return "font/ttf";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

async function copyFile(src: string, dst: string): Promise<void> {
  await mkdir(dirname(dst), { recursive: true });
  const bytes = await readFile(src);
  await writeFile(dst, bytes);
}

async function main(): Promise<void> {
  const outStat = await stat(OUT_DIR).catch(() => null);
  if (!outStat?.isDirectory()) {
    console.error(
      `[mirror-bundle] ${OUT_DIR} not found. Run \`next build\` first.`,
    );
    process.exit(1);
  }

  // Wipe + recreate bundle target so stale files from a previous build
  // don't linger.
  if (existsSync(BUNDLE_TARGET)) {
    await rm(BUNDLE_TARGET, { recursive: true, force: true });
  }
  await mkdir(BUNDLE_TARGET, { recursive: true });

  const filePaths: string[] = [];
  for await (const p of walk(OUT_DIR)) filePaths.push(p);
  console.info(`[mirror-bundle] mirroring ${filePaths.length} files…`);

  const index: IndexEntry[] = [];
  for (const file of filePaths) {
    const relPath = relative(OUT_DIR, file).split(sep).join("/");
    const sitePath = "/" + relPath;
    const dst = join(BUNDLE_TARGET, relPath);
    await copyFile(file, dst);
    const s = await stat(file);
    index.push({
      path: sitePath,
      contentType: contentTypeFor(file),
      sizeBytes: s.size,
    });
  }

  const indexPath = join(BUNDLE_TARGET, "index.json");
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
    `[mirror-bundle] wrote ${BUNDLE_TARGET} + index.json (${index.length} files)`,
  );
}

main().catch((err) => {
  console.error("[mirror-bundle] fatal:", err);
  process.exit(1);
});
