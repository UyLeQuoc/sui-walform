import { getWalrusAggregatorUrl } from './upload';

/**
 * Fetch a Walrus blob's raw bytes via the configured aggregator. Used by the
 * submission-decrypt path to follow a WAL: pointer back to its actual Seal
 * ciphertext payload.
 */
export async function fetchWalrusBlob(blobId: string): Promise<Uint8Array> {
  const url = `${getWalrusAggregatorUrl()}/v1/blobs/${blobId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Walrus aggregator returned ${response.status} for blob ${blobId}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
