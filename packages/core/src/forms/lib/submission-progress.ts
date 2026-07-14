import type { FieldValues } from 'react-hook-form';

/**
 * Per-respondent in-progress answer persistence (localStorage), keyed by form
 * id. Lets a submitter survive a page refresh, a wallet-connect redirect, or an
 * error without losing what they've typed. Cleared on a successful submit.
 *
 * Note: this is the RESPONDENT's answers, distinct from the CREATOR's draft
 * (which auto-saves to IndexedDB via the form-builder store).
 */
const KEY_PREFIX = 'walform:submit-progress:';
const storageKey = (id: string) => `${KEY_PREFIX}${id}`;

/** Restore saved answers for a form, or null if none / unavailable. */
export function readSubmissionProgress(
  persistKey: string | undefined,
): Record<string, unknown> | null {
  if (!persistKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(persistKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Persist the current answers. `File` instances are skipped (not
 * JSON-serializable) — the respondent re-attaches files after a refresh.
 * Best-effort: quota / serialization errors are swallowed.
 */
export function saveSubmissionProgress(persistKey: string, values: FieldValues): void {
  if (typeof window === 'undefined') return;
  try {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined || v === null || v === '') continue;
      if (typeof File !== 'undefined' && v instanceof File) continue;
      clean[k] = v;
    }
    if (Object.keys(clean).length === 0) {
      window.localStorage.removeItem(storageKey(persistKey));
      return;
    }
    window.localStorage.setItem(storageKey(persistKey), JSON.stringify(clean));
  } catch {
    // ignore — persistence is a best-effort nicety
  }
}

/** Drop saved answers (call after a successful submit). */
export function clearSubmissionProgress(persistKey: string | undefined): void {
  if (!persistKey || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(persistKey));
  } catch {
    // ignore
  }
}
