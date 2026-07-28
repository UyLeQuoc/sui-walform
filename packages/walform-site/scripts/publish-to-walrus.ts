#!/usr/bin/env bun
/**
 * Walks the static export at `out/`, uploads all files in a single Walrus
 * Quilt via `WalrusClient.writeFiles` (signed by `WALRUS_ADMIN_SECRET_KEY`),
 * and emits `out/walrus-manifest.json` mapping each path to its quilt patch
 * id + the shared quilt blob id.
 *
 * Run after `bun run build`:
 *
 *   WALRUS_ADMIN_SECRET_KEY=suiprivkey... bun run walrus:publish-site
 *
 * Why writeFiles (Quilt) over per-file writeBlob: one tx + one storage
 * reservation for the entire bundle instead of N. Far faster, less WAL spend,
 * and the resulting manifest still resolves files individually because each
 * `WalrusFile` carries a stable identifier (the site path).
 *
 * The manifest is the input for the Walrus Sites step (creating a Sui site
 * object pointing at these patches). That Move-call piece is intentionally
 * deferred — the official `site-builder` CLI from MystenLabs/walrus-sites can
 * consume a similar manifest, and a TS implementation belongs in a follow-up.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, stat, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { GrpcWebFetchTransport, SuiGrpcClient } from "@mysten/sui/grpc";
import { WalrusClient, WalrusFile, blobIdToInt } from "@mysten/walrus";

/**
 * Load env vars from candidate `.env.local` files. Bun auto-loads from CWD,
 * but this script runs from `packages/walform-site/` while the admin keypair
 * lives in `apps/builder/.env.local`. Walk a few likely paths so the user
 * doesn't have to copy the secret around.
 */
function loadEnvCandidates(scriptDir: string): void {
  const candidates = [
    resolve(scriptDir, "..", ".env.local"),
    resolve(scriptDir, "..", "..", "..", "apps", "builder", ".env.local"),
    resolve(scriptDir, "..", "..", "..", "apps", "contracts", ".env.local"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf-8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      // strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // env var already set (e.g. via shell) wins over .env.local
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

const OUT_DIR = process.env.WALFORM_SITE_OUT_DIR ?? "dist";
const NETWORK = (process.env.WALRUS_NETWORK ?? "testnet") as
  | "testnet"
  | "mainnet";
const EPOCHS = Number(process.env.WALRUS_EPOCHS ?? "5");
const AGGREGATOR =
  process.env.WALRUS_AGGREGATOR_URL ??
  "https://aggregator.walrus-testnet.walrus.space";

interface ManifestEntry {
  /** Site-relative path (always `/`-prefixed). */
  path: string;
  /** Full base64url quilt-patch id (37 bytes) — for aggregator URLs. */
  patchId: string;
  /** 5-byte internal-only hex — what `x-wal-quilt-patch-internal-id` resource header must store. */
  quiltPatchInternalIdHex: string;
  /** Aggregator URL that resolves the patch back to bytes. */
  url: string;
  sizeBytes: number;
  contentType: string;
  /** SHA-256 of the plaintext bytes, encoded as u256 little-endian decimal.
   *  Used by Walrus Sites' `site::new_resource` blob_hash arg. */
  blobHashU256: string;
}

function quiltPatchInternalHex(fullPatchIdBase64: string): string {
  const standard = fullPatchIdBase64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = standard + "=".repeat((4 - (standard.length % 4)) % 4);
  const bytes = Buffer.from(padded, "base64");
  if (bytes.length < 37) {
    throw new Error(
      `Quilt patch id too short (${bytes.length} bytes): ${fullPatchIdBase64}`,
    );
  }
  return bytes.subarray(32, 37).toString("hex");
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

/**
 * Convert raw little-endian SHA-256 bytes into the u256 decimal string Sui
 * Move expects. The Walrus Sites contract stores `blob_hash: u256` and the
 * site-builder Rust CLI computes it as `U256::from_le_bytes(sha256(content))`.
 * Same wire layout — just done in JS.
 */
function sha256ToU256DecimalLE(bytes: Uint8Array): string {
  const hash = createHash("sha256").update(bytes).digest(); // big-endian raw
  // Reverse to little-endian → BigInt accepts hex.
  const reversed = Buffer.from(hash).reverse();
  const hex = "0x" + reversed.toString("hex");
  return BigInt(hex).toString();
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

async function main(): Promise<void> {
  loadEnvCandidates(dirname(fileURLToPath(import.meta.url)));
  const privkey = process.env.WALRUS_ADMIN_SECRET_KEY;
  if (!privkey) {
    console.error(
      "[publish-to-walrus] WALRUS_ADMIN_SECRET_KEY not set. Export it before running.",
    );
    process.exit(1);
  }
  const { secretKey } = decodeSuiPrivateKey(privkey);
  const admin = Ed25519Keypair.fromSecretKey(secretKey);
  console.info(`[publish-to-walrus] signer = ${admin.toSuiAddress()}`);

  // gRPC, not JSON-RPC: Sui decommissioned public JSON-RPC (testnet's endpoint
  // already answers 404, mainnet's switches off 2026-07-31).
  const suiClient = new SuiGrpcClient({
    network: NETWORK,
    transport: new GrpcWebFetchTransport({
      baseUrl: process.env.SUI_GRPC_URL ?? `https://fullnode.${NETWORK}.sui.io`,
    }),
  });
  const walrus = new WalrusClient({ network: NETWORK, suiClient });

  const outStat = await stat(OUT_DIR).catch(() => null);
  if (!outStat?.isDirectory()) {
    console.error(
      `[publish-to-walrus] ${OUT_DIR} not found. Run \`next build\` first.`,
    );
    process.exit(1);
  }

  // Build the WalrusFile[] from every entry under OUT_DIR. Identifier = the
  // site-relative path so the aggregator can resolve files individually.
  const filePaths: string[] = [];
  for await (const p of walk(OUT_DIR)) filePaths.push(p);
  console.info(
    `[publish-to-walrus] found ${filePaths.length} files under ${OUT_DIR}/`,
  );

  const walrusFiles: WalrusFile[] = [];
  const meta: Array<{
    identifier: string;
    sizeBytes: number;
    contentType: string;
    blobHashU256: string;
  }> = [];
  for (const file of filePaths) {
    const identifier = "/" + relative(OUT_DIR, file).split(sep).join("/");
    const bytes = new Uint8Array(await readFile(file));
    const contentType = contentTypeFor(file);
    const blobHashU256 = sha256ToU256DecimalLE(bytes);
    walrusFiles.push(
      WalrusFile.from({
        contents: bytes,
        identifier,
        // Tags ride along with the patch on Walrus and become readable by
        // any aggregator that surfaces them. Helpful for site-builder
        // consumers to set the right Content-Type without re-sniffing.
        tags: { "content-type": contentType },
      }),
    );
    meta.push({
      identifier,
      sizeBytes: bytes.byteLength,
      contentType,
      blobHashU256,
    });
  }

  console.info(
    `[publish-to-walrus] uploading as one Quilt (${EPOCHS} epoch storage)…`,
  );
  const results = await walrus.writeFiles({
    files: walrusFiles,
    deletable: false,
    epochs: EPOCHS,
    signer: admin,
  });

  // All entries from a single writeFiles call share the same blobId
  // (the Quilt's underlying blob); only the patch `id` differs.
  const quiltBlobId = results[0]?.blobId;
  if (!quiltBlobId) {
    console.error("[publish-to-walrus] writeFiles returned no results");
    process.exit(1);
  }
  // SDK returns the URL-safe base64 form (`R8t1…`) which is what aggregator
  // URLs need. Walrus Sites Move expects the same id as a u256 decimal —
  // `blobIdToInt` does the conversion (BCS-encodes the base64 → bigint).
  // Both forms ship in the manifest so the deploy button doesn't have to
  // pull the SDK in just for this conversion.
  const quiltBlobIdU256 = blobIdToInt(quiltBlobId).toString();
  console.info(
    `[publish-to-walrus] quilt blob = ${quiltBlobId} (u256: ${quiltBlobIdU256})`,
  );

  const manifestEntries: ManifestEntry[] = results.map((res, i) => {
    const m = meta[i]!;
    return {
      path: m.identifier,
      patchId: res.id,
      quiltPatchInternalIdHex: quiltPatchInternalHex(res.id),
      // by-quilt-patch-id is the canonical aggregator endpoint for resolving
      // a single file out of a Quilt blob.
      url: `${AGGREGATOR}/v1/blobs/by-quilt-patch-id/${res.id}`,
      sizeBytes: m.sizeBytes,
      contentType: m.contentType,
      blobHashU256: m.blobHashU256,
    };
  });

  const manifestBody = {
    publishedAt: new Date().toISOString(),
    network: NETWORK,
    epochs: EPOCHS,
    signer: admin.toSuiAddress(),
    /** URL-safe base64 form — used in aggregator URLs. */
    quiltBlobId,
    /** Same blob, expressed as u256 decimal — used by Walrus Sites Move. */
    quiltBlobIdU256,
    files: manifestEntries,
  };
  const manifestJson = JSON.stringify(manifestBody, null, 2);

  const manifestPath = join(OUT_DIR, "walrus-manifest.json");
  await writeFile(manifestPath, manifestJson);
  console.info(
    `\n[publish-to-walrus] wrote manifest → ${manifestPath} (${manifestEntries.length} files in 1 quilt)`,
  );

  // Mirror into the builder's /public so the in-app DeployToWalrusSiteButton
  // can fetch it via `/walform-site-manifest.json` without an extra build
  // step. Skip if the user runs the script outside the monorepo.
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const builderPublic = resolve(
    scriptDir,
    "..",
    "..",
    "..",
    "apps",
    "builder",
    "public",
  );
  const builderManifest = join(builderPublic, "walform-site-manifest.json");
  try {
    await mkdir(builderPublic, { recursive: true });
    await writeFile(builderManifest, manifestJson);
    console.info(`[publish-to-walrus] mirrored manifest → ${builderManifest}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[publish-to-walrus] could not mirror to builder/public: ${msg}`,
    );
  }
}

main().catch((err) => {
  console.error("[publish-to-walrus] fatal:", err);
  process.exit(1);
});
