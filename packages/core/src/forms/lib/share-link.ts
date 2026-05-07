/**
 * Public submit-page URL for a form. Falls back to the deployed origin when
 * the function runs server-side (no `window`).
 */
const FALLBACK_ORIGIN = 'https://walform.app';

export function buildFormShareLink(formId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : FALLBACK_ORIGIN;
  return `${origin}/f/${formId}`;
}

/**
 * Copy the share link for `formId` to the clipboard. Returns `true` when the
 * write succeeds — older browsers / iframes without clipboard permission
 * resolve `false` quietly so the caller can fall back to a "select to copy"
 * affordance instead of throwing.
 */
export async function copyFormShareLink(formId: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(buildFormShareLink(formId));
    return true;
  } catch {
    return false;
  }
}
