import { NextResponse, type NextRequest } from 'next/server';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { applyCors, isAllowedOrigin } from '@/lib/cors';

// Force dynamic so Next.js doesn't try to collect page data for this route at
// build time. The `@mysten/walrus` SDK loads a WASM blob at module-eval time
// and Turbopack mis-resolves its path during the build-time data collection
// pass, which crashes the build. Combined with the lazy import below, the
// module only loads in real Node runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-side Walrus upload using `@mysten/walrus` SDK. The browser POSTs raw
 * bytes; the route uses an operator-controlled keypair (`WALRUS_ADMIN_SECRET_KEY`)
 * to pay Sui gas for the registration tx + WAL storage cost. Browser never
 * sees the key.
 *
 * Why server-side: the SDK's `writeBlob` needs a `Signer` and pays WAL out of
 * that signer's wallet. Cover images and FILE_UPLOAD attachments are too
 * large + frequent for browser-side WASM uploads to be reliable, and asking
 * creators/respondents to hold WAL just to attach an image is poor UX.
 *
 * NOTE: this is purely a Walrus-storage payer. WalForm has no app-level
 * sponsorship for Sui transactions — every Sui tx is signed and paid by
 * the user's connected wallet. The Mode B Walrus-Site deploy also runs
 * browser-side via the user's wallet (see `WalrusWalletSigner`).
 *
 * Limits: 4 MiB body cap (matches Next.js default + matches the client-side
 * cover-image size cap). Anything larger 413s here so we never reach the SDK.
 */

const MAX_BYTES = 4 * 1024 * 1024;

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  applyCors(res.headers, req.headers.get('origin'));
  // The upload route accepts a custom header (X-Walrus-Epochs) — must be
  // listed in Access-Control-Allow-Headers or the preflight rejects.
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Walrus-Epochs');
  return res;
}

export async function POST(req: NextRequest): Promise<Response> {
  const origin = req.headers.get('origin');
  const respond = (status: number, body: unknown) => {
    const res = NextResponse.json(body, { status });
    applyCors(res.headers, origin);
    return res;
  };
  // Same-origin requests don't carry an Origin header — only block when the
  // browser sent one and it's outside the allowlist.
  if (origin && !isAllowedOrigin(origin)) {
    return NextResponse.json({ error: 'origin not allowed' }, { status: 403 });
  }

  const privkey = process.env.WALRUS_ADMIN_SECRET_KEY;
  if (!privkey) {
    return respond(503, {
      error: 'WALRUS_ADMIN_SECRET_KEY missing — Walrus upload disabled',
    });
  }
  const network = (process.env.NEXT_PUBLIC_WALRUS_NETWORK ?? 'testnet') as
    | 'testnet'
    | 'mainnet'
    | 'devnet';
  if (network !== 'testnet' && network !== 'mainnet') {
    return respond(400, { error: `Walrus does not run on ${network}` });
  }

  const epochsHeader = req.headers.get('x-walrus-epochs');
  const epochs = epochsHeader ? Number(epochsHeader) : 5;
  if (!Number.isFinite(epochs) || epochs < 1 || epochs > 53) {
    return respond(400, { error: 'invalid x-walrus-epochs' });
  }

  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) {
    return respond(400, { error: 'empty body' });
  }
  if (buf.byteLength > MAX_BYTES) {
    return respond(413, { error: `body too large (${buf.byteLength} > ${MAX_BYTES})` });
  }
  const bytes = new Uint8Array(buf);

  const { secretKey } = decodeSuiPrivateKey(privkey);
  const admin = Ed25519Keypair.fromSecretKey(secretKey);

  const suiClient = new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl(network),
    network,
  });

  // Route uploads via the public testnet upload relay so this server only
  // talks to one HTTP endpoint instead of N storage nodes (more reliable +
  // matches "use existing testnet infra, no self-hosting" goal). The relay
  // accepts the bytes + the registration tx the SDK builds, then handles
  // the storage-node fan-out + certificate collection on its side.
  // Override via WALRUS_UPLOAD_RELAY_HOST if a private relay is preferred.
  const uploadRelayHost =
    process.env.WALRUS_UPLOAD_RELAY_HOST ?? 'https://upload-relay.testnet.walrus.space';
  // Tip cap in MIST (1 SUI = 1e9 MIST). The Mysten public testnet relay
  // requires a tip (it returns 400 "missing tx id or nonce" otherwise).
  // Short form `{ max }` makes the SDK fetch the relay's `/v1/tip-config`
  // (address + strategy) and clamp the actual tip below `max`. Default
  // 1_000_000 MIST = 0.001 SUI ceiling — more than enough for any
  // reasonable tip strategy on testnet. Guard against malformed env values
  // (NaN / Infinity / negative) so a typo in deployment doesn't tip
  // arbitrary amounts to the relay.
  const rawTipMax = Number(process.env.WALRUS_UPLOAD_RELAY_TIP_MAX_MIST ?? 1_000_000);
  const tipMaxMist =
    Number.isFinite(rawTipMax) && rawTipMax >= 0 && rawTipMax <= 1_000_000_000
      ? rawTipMax
      : 1_000_000;
  // Lazy import so the WASM payload is only loaded at request time, never at
  // build/collect time. See the dynamic export above.
  const { WalrusClient } = await import('@mysten/walrus');
  const walrus = new WalrusClient({
    network,
    suiClient,
    uploadRelay: {
      host: uploadRelayHost,
      sendTip: { max: tipMaxMist },
    },
  });

  try {
    const { blobId } = await walrus.writeBlob({
      blob: bytes,
      deletable: false,
      epochs,
      signer: admin,
    });
    const aggregator =
      process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ??
      'https://aggregator.walrus-testnet.walrus.space';
    return respond(200, {
      blobId,
      url: `${aggregator}/v1/blobs/${blobId}`,
    });
  } catch (err) {
    // Log full detail server-side; return a generic message so we don't echo
    // Walrus relay/storage-node internals back to the browser.
    console.error('[walrus/upload] writeBlob failed:', err);
    return respond(502, { error: 'Walrus upload failed' });
  }
}
