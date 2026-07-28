// WalForm Walrus file sponsor — Node service (Railway), Hono.
//
// The platform pays WAL (+ relay tip + gas) for respondents' submission file
// uploads so Web2 users never touch WAL. The client POSTs file bytes; this
// service writes them to Walrus with the PLATFORM keypair (as the blob owner)
// and returns the quilt blob id + per-file patch ids. Blobs are public on
// Walrus regardless of owner, so the aggregator URLs the client builds work.
//
// Runs on Node (not an edge runtime) so it has real RAM — Walrus erasure-coding
// expands the blob ~5-8x in memory, so size the Railway instance accordingly
// (~2 GB RAM comfortably covers the default 100 MiB cap).
//
// Protocol (matches the client's sponsoredQuiltUpload):
//   POST /  { network, sender, files: [{ identifier, bytesB64 }] }
//   → { quiltBlobId, files: [{ identifier, patchId }] }
//   GET /health → { ok: true }
//
// Env (Railway → Variables):
//   WALRUS_SPONSOR_KEY    Sui private key (suiprivkey1...) of the platform wallet, funded WAL+SUI.
//   ALLOWED_ORIGIN        Comma-separated origins, e.g. "https://walform.wal.app,http://localhost:3000". Unset/"*" = any.
//   SPONSOR_MAX_BYTES     Per-request byte cap. Default 104857600 (100 MiB).
//   SPONSOR_EPOCHS        Storage duration in epochs. Default 15.
//   SPONSOR_TIP_MAX_MIST  Max relay tip (MIST). Default 100000000 (0.1 SUI).
//   SPONSOR_DAILY_BYTES   Per-wallet per-day byte quota. Default 524288000 (500 MiB).
//   SPONSOR_DAILY_COUNT   Per-wallet per-day upload count. Default 50.
//   PORT                  Injected by Railway.

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WalrusClient, WalrusFile } from '@mysten/walrus';
import { GrpcWebFetchTransport, SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

type Network = 'testnet' | 'mainnet';

const RELAY_HOST: Record<Network, string> = {
  testnet: 'https://upload-relay.testnet.walrus.space',
  mainnet: 'https://upload-relay.mainnet.walrus.space',
};

const numEnv = (key: string, fallback: number): number => {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const SPONSOR_KEY = process.env.WALRUS_SPONSOR_KEY;

function originAllowed(origin: string | undefined): boolean {
  const raw = process.env.ALLOWED_ORIGIN?.trim();
  if (!raw || raw === '*') return true;
  if (!origin) return false;
  return raw.split(',').map((s) => s.trim()).filter(Boolean).includes(origin);
}

// ─── Rate limit (in-memory, per-wallet per-day) ──────────────────────────────
// A single Railway instance keeps this map hot. Scale to >1 replica → move this
// to Redis/Postgres; an in-memory counter is per-instance.
const usage = new Map<string, { day: string; bytes: number; count: number }>();

function checkAndBumpQuota(wallet: string, bytes: number): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const dailyBytes = numEnv('SPONSOR_DAILY_BYTES', 500 * 1024 * 1024);
  const dailyCount = numEnv('SPONSOR_DAILY_COUNT', 50);
  const cur = usage.get(wallet);
  const base = cur && cur.day === today ? cur : { day: today, bytes: 0, count: 0 };
  if (base.count + 1 > dailyCount) return 'Daily sponsored-upload limit reached for this wallet.';
  if (base.bytes + bytes > dailyBytes) return 'Daily sponsored-storage limit reached for this wallet.';
  usage.set(wallet, { day: today, bytes: base.bytes + bytes, count: base.count + 1 });
  return null;
}

const app = new Hono();

app.use(
  '*',
  cors({
    origin: (origin) => (originAllowed(origin) ? origin || '*' : null),
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['content-type'],
    maxAge: 86400,
  }),
);

app.get('/health', (c) => c.json({ ok: true }));

app.post('/', async (c) => {
  const origin = c.req.header('origin');
  if (!originAllowed(origin)) return c.json({ error: 'Origin not allowed' }, 403);
  if (!SPONSOR_KEY) return c.json({ error: 'WALRUS_SPONSOR_KEY not configured' }, 500);

  let body: {
    network?: Network;
    sender?: string;
    files?: { identifier?: string; bytesB64?: string }[];
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { network, sender, files } = body;
  if (network !== 'testnet' && network !== 'mainnet') {
    return c.json({ error: 'network must be testnet | mainnet' }, 400);
  }
  if (!sender || typeof sender !== 'string') return c.json({ error: 'Missing sender' }, 400);
  if (!Array.isArray(files) || files.length === 0) {
    return c.json({ error: 'files must be a non-empty array' }, 400);
  }

  const maxBytes = numEnv('SPONSOR_MAX_BYTES', 100 * 1024 * 1024);
  const decoded: { identifier: string; bytes: Uint8Array }[] = [];
  let total = 0;
  for (const f of files) {
    if (!f?.identifier || typeof f.bytesB64 !== 'string') {
      return c.json({ error: 'Each file needs identifier + bytesB64' }, 400);
    }
    const bytes = new Uint8Array(Buffer.from(f.bytesB64, 'base64'));
    total += bytes.length;
    decoded.push({ identifier: f.identifier, bytes });
  }
  if (total > maxBytes) {
    return c.json({ error: 'over_size_cap', maxBytes, totalBytes: total }, 413);
  }

  const quotaReason = checkAndBumpQuota(sender, total);
  if (quotaReason) return c.json({ error: 'rate_limited', detail: quotaReason }, 429);

  try {
    const keypair = Ed25519Keypair.fromSecretKey(SPONSOR_KEY);
    // gRPC, not JSON-RPC: Sui decommissioned public JSON-RPC (testnet's
    // endpoint answers 404 already, mainnet's switches off 2026-07-31). The
    // Walrus SDK only needs the shared `core` API, which SuiGrpcClient
    // implements. Override the endpoint per-deploy with SUI_GRPC_URL.
    const suiClient = new SuiGrpcClient({
      network,
      transport: new GrpcWebFetchTransport({
        baseUrl: process.env.SUI_GRPC_URL ?? `https://fullnode.${network}.sui.io`,
      }),
    });
    const walrus = new WalrusClient({
      network,
      suiClient,
      uploadRelay: {
        host: RELAY_HOST[network],
        sendTip: { max: numEnv('SPONSOR_TIP_MAX_MIST', 100_000_000) },
      },
    });

    // Mirror the client's identifier sort so results zip back deterministically.
    const ordered = [...decoded].sort((a, b) =>
      a.identifier < b.identifier ? -1 : a.identifier > b.identifier ? 1 : 0,
    );
    const walrusFiles = ordered.map((f) =>
      WalrusFile.from({ contents: f.bytes, identifier: f.identifier }),
    );

    const results = await walrus.writeFiles({
      files: walrusFiles,
      signer: keypair,
      epochs: numEnv('SPONSOR_EPOCHS', 15),
      deletable: false,
    });

    const quiltBlobId = results[0]?.blobId;
    if (!quiltBlobId) return c.json({ error: 'writeFiles returned no results' }, 502);

    const out = ordered.map((f, i) => ({ identifier: f.identifier, patchId: results[i]!.id }));
    return c.json({ quiltBlobId, files: out });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[walrus-sponsor] write failed:', detail);
    return c.json({ error: 'walrus_write_failed', detail }, 502);
  }
});

const port = Number(process.env.PORT) || 8787;
serve({ fetch: app.fetch, port }, (info) => console.log(`[walrus-sponsor] listening on :${info.port}`));
