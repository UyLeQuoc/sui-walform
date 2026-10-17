import { normalizeSuiAddress } from '@mysten/sui/utils';
import type { FormSettings, ReferralRecord, ReferredPerson, ReferrerStanding } from '../../types';

/** Query parameter carrying the referrer's Submission id. */
export const REFERRAL_PARAM = 'ref';

const OBJECT_ID = /^0x[0-9a-fA-F]{1,64}$/;

/**
 * The referrer Submission id from a page URL: `?ref=` (builder `/f`, Mode B
 * shell) or the query part of a hash route (`#/f/0x…?ref=`). Null when absent
 * or not an object id.
 */
export function parseReferralParam(search: string, hash: string): string | null {
  const fromSearch = new URLSearchParams(search).get(REFERRAL_PARAM);
  const q = hash.indexOf('?');
  const fromHash = q >= 0 ? new URLSearchParams(hash.slice(q + 1)).get(REFERRAL_PARAM) : null;
  const raw = fromSearch ?? fromHash;
  return raw && OBJECT_ID.test(raw) ? normalizeSuiAddress(raw) : null;
}

/** `href` with `ref` set to `submissionId` — the page the respondent is on, so Mode B links stay on the form's own site. */
export function buildReferralLink(href: string, submissionId: string): string {
  const url = new URL(href);
  url.searchParams.set(REFERRAL_PARAM, submissionId);
  return url.toString();
}

export function referralsEnabled(settings: FormSettings): boolean {
  return settings.referrals?.enabled ?? false;
}

export function publicLeaderboardEnabled(settings: FormSettings): boolean {
  return referralsEnabled(settings) && (settings.referrals?.publicLeaderboard ?? false);
}

/**
 * Referrers ranked by how many distinct people they brought in, then by
 * submissions, then most recent activity. Each standing lists who they invited.
 */
export function referralLeaderboard(records: ReferralRecord[]): ReferrerStanding[] {
  const byReferrer = new Map<string, Map<string, ReferredPerson>>();
  for (const r of records) {
    const invited = byReferrer.get(r.referrer) ?? new Map<string, ReferredPerson>();
    const prev = invited.get(r.submitter);
    invited.set(r.submitter, {
      address: r.submitter,
      submissions: (prev?.submissions ?? 0) + 1,
      firstReferredAtMs: Math.min(prev?.firstReferredAtMs ?? r.submittedAtMs, r.submittedAtMs),
      lastReferredAtMs: Math.max(prev?.lastReferredAtMs ?? 0, r.submittedAtMs),
    });
    byReferrer.set(r.referrer, invited);
  }
  const standings: ReferrerStanding[] = [...byReferrer].map(([referrer, invitedMap]) => {
    const invited = [...invitedMap.values()].sort(
      (a, b) => b.lastReferredAtMs - a.lastReferredAtMs,
    );
    return {
      referrer,
      people: invited.length,
      submissions: invited.reduce((n, p) => n + p.submissions, 0),
      lastReferredAtMs: invited[0]?.lastReferredAtMs ?? 0,
      invited,
    };
  });
  return standings.sort(
    (a, b) =>
      b.people - a.people ||
      b.submissions - a.submissions ||
      b.lastReferredAtMs - a.lastReferredAtMs,
  );
}

/** Distinct people `address` brought in, across all of their links. */
export function referralCountFor(records: ReferralRecord[], address: string): number {
  const who = normalizeSuiAddress(address);
  return new Set(records.filter((r) => r.referrer === who).map((r) => r.submitter)).size;
}

/** Distinct people brought in by any referral link. */
export function referredPeopleCount(records: ReferralRecord[]): number {
  return new Set(records.map((r) => r.submitter)).size;
}

/** Submission id → the address whose link brought it. */
export function referrerBySubmission(records: ReferralRecord[]): Record<string, string> {
  return Object.fromEntries(records.map((r) => [r.submissionId, r.referrer]));
}

/** How long an opened referral link keeps crediting its referrer on that browser. */
export const REFERRAL_MEMORY_MS = 30 * 24 * 60 * 60 * 1000;

/** A referral remembered on this browser for one form. */
export interface StoredReferral {
  submissionId: string;
  savedAtMs: number;
}

/**
 * Which referral a visit credits. First touch wins: a remembered referral
 * younger than `REFERRAL_MEMORY_MS` beats the one in the URL, so coming back
 * through someone else's link — or a plain link — doesn't steal the credit.
 */
export function chooseReferral(
  fromUrl: string | null,
  stored: StoredReferral | null,
  nowMs: number,
): { submissionId: string; remembered: boolean } | null {
  if (stored && nowMs - stored.savedAtMs < REFERRAL_MEMORY_MS) {
    return { submissionId: stored.submissionId, remembered: true };
  }
  return fromUrl ? { submissionId: fromUrl, remembered: false } : null;
}
