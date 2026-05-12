/**
 * Pure browser-side helpers for Walrus blob URLs + data-URL ↔ bytes
 * conversion. Actual upload happens through `useWalrusWalletUpload()` in
 * `./wallet-upload`, which signs the registration tx with the user's wallet —
 * there is no app-level WAL payer.
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
