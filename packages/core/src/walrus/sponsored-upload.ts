import {
  getWalrusAggregatorUrl,
  getWalrusSponsorMaxBytes,
  getWalrusSponsorUrl,
} from '../sui/env-network';
import type { QuiltFileInput, QuiltFileResult, QuiltUploadResult } from './wallet-upload';

/**
 * True iff the platform Walrus sponsor is configured AND the payload fits under
 * the sponsored size cap. Callers use this to decide whether to try the
 * sponsor before falling back to the wallet-paid `uploadQuilt`.
 */
export function canSponsorUpload(totalBytes: number): boolean {
  return !!getWalrusSponsorUrl() && totalBytes <= getWalrusSponsorMaxBytes();
}

/** Chunked base64 — spreading a big Uint8Array into fromCharCode overflows the stack. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Upload a Quilt through the platform sponsor endpoint — the PLATFORM pays WAL
 * (+ relay tip + gas), so the respondent needs no WAL. Returns the SAME shape
 * as `uploadQuilt` (results in input order) so it's a drop-in replacement.
 *
 * Throws on any failure (endpoint unset, over cap, rate-limited, network) — the
 * caller MUST catch and fall back to the wallet-paid path.
 */
export async function sponsoredQuiltUpload(
  files: QuiltFileInput[],
  opts: { network: 'testnet' | 'mainnet'; sender: string },
): Promise<QuiltUploadResult> {
  const url = getWalrusSponsorUrl();
  if (!url) throw new Error('Walrus sponsor endpoint not configured.');
  if (files.length === 0) throw new Error('sponsoredQuiltUpload requires at least one file.');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      network: opts.network,
      sender: opts.sender,
      files: files.map((f) => ({ identifier: f.identifier, bytesB64: toBase64(f.bytes) })),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Sponsor upload failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    quiltBlobId: string;
    files: { identifier: string; patchId: string }[];
  };
  const aggregator = getWalrusAggregatorUrl(opts.network);
  const byId = new Map(data.files.map((f) => [f.identifier, f.patchId]));

  // Re-map to caller input order (endpoint returns sorted-by-identifier).
  const outFiles: QuiltFileResult[] = files.map((f) => {
    const patchId = byId.get(f.identifier);
    if (!patchId) throw new Error(`Sponsor result missing patch for ${f.identifier}`);
    return {
      identifier: f.identifier,
      patchId,
      url: `${aggregator}/v1/blobs/by-quilt-patch-id/${patchId}`,
    };
  });

  return { quiltBlobId: data.quiltBlobId, files: outFiles };
}
