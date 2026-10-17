import { expect, test } from 'bun:test';
import { normalizeSuiAddress } from '@mysten/sui/utils';

import {
  REFERRAL_MEMORY_MS,
  buildReferralLink,
  chooseReferral,
  parseReferralParam,
  referralCountFor,
  referralLeaderboard,
  referredPeopleCount,
} from './referrals';

import type { ReferralRecord } from '../../types';

const A = normalizeSuiAddress('0xa');
const B = normalizeSuiAddress('0xb');
const C = normalizeSuiAddress('0xc');
const D = normalizeSuiAddress('0xd');

let n = 0;
function rec(referrer: string, submitter: string, at: number): ReferralRecord {
  n++;
  return {
    submissionId: normalizeSuiAddress(`0x${n.toString(16)}`),
    submitter,
    referrer,
    referrerSubmissionId: normalizeSuiAddress('0x99'),
    submittedAtMs: at,
  };
}

test('ranks by distinct people, not submissions', () => {
  // A brought B three times; C brought B and D once each.
  const records = [rec(A, B, 1), rec(A, B, 2), rec(A, B, 3), rec(C, B, 4), rec(C, D, 5)];
  const board = referralLeaderboard(records);
  expect(board.map((s) => [s.referrer, s.people, s.submissions])).toEqual([
    [C, 2, 2],
    [A, 1, 3],
  ]);
  expect(board[1]?.invited).toEqual([
    { address: B, submissions: 3, firstReferredAtMs: 1, lastReferredAtMs: 3 },
  ]);
  expect(board[0]?.invited.map((p) => p.address)).toEqual([D, B]); // most recent first
  expect(referralCountFor(records, A)).toBe(1);
  expect(referralCountFor(records, '0xc')).toBe(2);
  expect(referredPeopleCount(records)).toBe(2);
});

test('ties break on submissions, then recency', () => {
  const board = referralLeaderboard([rec(A, B, 1), rec(C, D, 9), rec(C, D, 10)]);
  expect(board.map((s) => s.referrer)).toEqual([C, A]);
});

test('first touch wins while the remembered referral is fresh', () => {
  const stored = { submissionId: A, savedAtMs: 1_000 };
  expect(chooseReferral(B, stored, 2_000)).toEqual({ submissionId: A, remembered: true });
  expect(chooseReferral(null, stored, 2_000)).toEqual({ submissionId: A, remembered: true });
  const expired = 1_000 + REFERRAL_MEMORY_MS;
  expect(chooseReferral(B, stored, expired)).toEqual({ submissionId: B, remembered: false });
  expect(chooseReferral(null, stored, expired)).toBeNull();
  expect(chooseReferral(null, null, 0)).toBeNull();
});

test('reads ?ref= from the query or a hash route, rejects junk', () => {
  expect(parseReferralParam('?formId=0x1&ref=0xabc', '')).toBe(normalizeSuiAddress('0xabc'));
  expect(parseReferralParam('', '#/f/0x1?ref=0xabc')).toBe(normalizeSuiAddress('0xabc'));
  expect(parseReferralParam('?ref=hello', '')).toBeNull();
  expect(parseReferralParam('', '')).toBeNull();
});

test('a referral link keeps the page and replaces any previous ref', () => {
  expect(buildReferralLink('https://x.app/f?formId=0x1&ref=0xold', '0xnew')).toBe(
    'https://x.app/f?formId=0x1&ref=0xnew',
  );
  expect(buildReferralLink('https://site.wal.app/#/f/0x1', '0xnew')).toBe(
    'https://site.wal.app/?ref=0xnew#/f/0x1',
  );
});
