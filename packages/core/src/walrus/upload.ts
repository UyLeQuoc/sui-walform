/**
 * Pure browser-side helpers for Walrus blob URLs + data-URL ↔ bytes
 * conversion. Actual upload happens through `useWalrusWalletUpload()` in
 * `./wallet-upload`, which signs the registration tx with the user's wallet —
 * there is no app-level WAL payer.
 *
 * Aggregator host is network-aware. Use `getWalrusAggregatorUrl(network)`
 * directly when you already have the active network in scope, or the
 * `useActiveWalrusAggregatorUrl()` hook from `sui/env-network`.
 */

export { getWalrusAggregatorUrl, useActiveWalrusAggregatorUrl } from '../sui/env-network';
import { getWalrusAggregatorUrl } from '../sui/env-network';

export function resolveBlobUrl(blobId: string, network: 'testnet' | 'mainnet'): string {
  return `${getWalrusAggregatorUrl(network)}/v1/blobs/${blobId}`;
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
