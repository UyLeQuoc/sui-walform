/**
 * CORS allowlist for the builder's API routes.
 *
 * The Mode B Walrus-hosted shell calls back into `/api/walrus/upload` (cover
 * images, file attachments) from a `<base36>.wal.app` origin. We allowlist
 * any `*.wal.app` host plus the standard local-dev ports.
 *
 * `i` flag is defense-in-depth: per RFC 3986 hostnames are case-insensitive,
 * and browsers send Origin lowercased today, but spec-permitted variants
 * shouldn't bypass the allowlist. The character class is simple and bounded
 * (single `+` quantifier on `[a-z0-9-]`), so there's no catastrophic-backtrack
 * surface.
 */
const ALLOWED_ORIGIN_RE =
  /^(https?:\/\/([a-z0-9-]+\.)?wal\.app|http:\/\/localhost:(3000|3001|8080))$/i;

// Hard cap so an attacker-supplied multi-MB Origin header can't run the
// regex over arbitrary input. Real origins are < 256 chars in practice.
const MAX_ORIGIN_LEN = 256;

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin || origin.length > MAX_ORIGIN_LEN) return false;
  return ALLOWED_ORIGIN_RE.test(origin);
}

export function applyCors(headers: Headers, origin: string | null): void {
  if (!isAllowedOrigin(origin)) return;
  headers.set('Access-Control-Allow-Origin', origin!);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '600');
}
