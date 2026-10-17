import { normalizeSuiAddress } from '@mysten/sui/utils';
import type { StoredReferral } from '../lib/referrals';

// Per-browser memory of the referral link a respondent arrived through, so a
// later visit without `?ref=` still credits the referrer. localStorage can be
// unavailable (private mode, blocked storage) — every access degrades to "no
// memory" rather than failing the page.

const OBJECT_ID = /^0x[0-9a-f]{64}$/;

function key(formId: string): string {
  return `walform:referral:${normalizeSuiAddress(formId)}`;
}

export function readStoredReferral(formId: string): StoredReferral | null {
  try {
    const raw = localStorage.getItem(key(formId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<StoredReferral>;
    return typeof v.submissionId === 'string' &&
      OBJECT_ID.test(v.submissionId) &&
      typeof v.savedAtMs === 'number'
      ? { submissionId: v.submissionId, savedAtMs: v.savedAtMs }
      : null;
  } catch {
    return null;
  }
}

export function storeReferral(formId: string, referral: StoredReferral): void {
  try {
    localStorage.setItem(key(formId), JSON.stringify(referral));
  } catch {
    // Storage unavailable — the link still works for this visit.
  }
}

export function forgetReferral(formId: string): void {
  try {
    localStorage.removeItem(key(formId));
  } catch {
    // Nothing to clean up.
  }
}
