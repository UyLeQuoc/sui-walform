/**
 * Browser-side wrapper around `/api/walrus/upload`. The server uses the
 * `@mysten/walrus` SDK (`WalrusClient.writeBlob`) backed by an
 * operator-controlled keypair (`WALRUS_ADMIN_SECRET_KEY`) so creators and
 * respondents don't need to hold WAL.
 *
 * This route only pays Walrus storage cost — it does NOT sign Sui
 * transactions on behalf of users. Every Sui tx in WalForm is signed and
 * paid by the user's connected wallet.
 *
 * Why not call the SDK directly from the browser for cover/file uploads:
 * `writeBlob` needs a `Signer` that pays WAL, and the WASM-based browser
 * SDK is less reliable for arbitrary file sizes than a Node-runtime call.
 * Mode B Walrus-Site bundle deploys do go through the browser via
 * `WalrusWalletSigner` — see `DeployToWalrusSiteButton`.
 */

const DEFAULT_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

export function getWalrusAggregatorUrl(): string {
  return (
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL) ||
    DEFAULT_AGGREGATOR
  );
}

export function resolveBlobUrl(blobId: string): string {
  return `${getWalrusAggregatorUrl()}/v1/blobs/${blobId}`;
}

export interface PutBlobResult {
  blobId: string;
  url: string;
}

/**
 * Decode a `data:` URL back to raw bytes. Splits on the first `,` since
 * base64 doesn't contain that character. Throws on malformed input.
 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) throw new Error('Invalid data URL — no comma separator');
  const b64 = dataUrl.slice(comma + 1);
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

/**
 * POST raw bytes to the server's Walrus upload route. `epochs` controls
 * storage lifetime (default 5 ≈ a few weeks on testnet — plenty for demo).
 */
export async function putBlob(
  bytes: Uint8Array,
  options: {
    epochs?: number;
    signal?: AbortSignal;
    endpoint?: string;
  } = {},
): Promise<PutBlobResult> {
  const { epochs = 5, signal, endpoint = '/api/walrus/upload' } = options;
  // ArrayBuffer body avoids form-multipart overhead. Type hint via header so
  // an aggregator that re-serves the blob could content-sniff if it wanted.
  const buf = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const res = await fetch(endpoint, {
    method: 'POST',
    body: buf,
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Walrus-Epochs': String(epochs),
    },
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Walrus upload rejected ${res.status}: ${text || res.statusText}`);
  }
  const body = (await res.json()) as { blobId?: string; url?: string; error?: string };
  if (!body.blobId || !body.url) {
    throw new Error(`Walrus upload missing blobId/url: ${body.error ?? JSON.stringify(body)}`);
  }
  return { blobId: body.blobId, url: body.url };
}
