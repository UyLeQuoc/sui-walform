'use client';

import { useEffect, useState } from 'react';

const HASH_PREFIX = 'prefill=';

/**
 * Read a `#prefill=<base64url-json>` handoff from the page URL — produced by
 * the Walrus Site bundle's static-form submit step (see
 * `forms/lib/walrus-site/templates/app-js.ts`). The hash is decoded into a
 * `Record<string, unknown>` that callers feed into `<FormPreview prefill={…} />`
 * so the submitter doesn't have to retype anything they already entered on
 * the static site.
 *
 * Once read, the hook strips the hash from the URL via `replaceState` so a
 * later refresh doesn't replay the prefill (and the hash isn't logged in
 * navigation referrers). Returns `null` until the first effect runs (server
 * rendering) and after a hash without a prefill segment.
 */
export function usePrefillFromHash(): Record<string, unknown> | null {
  const [prefill, setPrefill] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash.startsWith(HASH_PREFIX)) return;
    const encoded = hash.slice(HASH_PREFIX.length);
    try {
      const decoded = base64UrlDecode(encoded);
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Reading window.location.hash is by definition pulling external (URL)
        // state into React, which is exactly what an effect is for. The
        // `react-hooks/set-state-in-effect` rule warns about cascading
        // renders; here it's a single setState that fires once on mount and
        // never repeats (the dep array is `[]` and the URL is wiped below),
        // so the cascade concern doesn't apply.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefill(parsed as Record<string, unknown>);
      }
    } catch (err) {
      console.warn('[usePrefillFromHash] failed to decode prefill hash', err);
    } finally {
      // Strip the hash so a refresh doesn't replay the prefill (and so the
      // raw payload doesn't leak into navigation referrers / analytics).
      const url = new URL(window.location.href);
      url.hash = '';
      window.history.replaceState(window.history.state, '', url.toString());
    }
  }, []);

  return prefill;
}

function base64UrlDecode(s: string): string {
  // Restore standard base64 alphabet + padding before atob.
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '==='.slice((b64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
