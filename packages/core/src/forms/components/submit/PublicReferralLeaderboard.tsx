'use client';

import { Trophy } from 'lucide-react';
import { useFormReferrals } from '../../hooks/use-form-referrals';
import { ReferralLeaderboard } from '../referrals/ReferralLeaderboard';

const TOP = 5;

/** Top referrers under the form, when the creator made the leaderboard public. */
export function PublicReferralLeaderboard({
  formId,
  viewer,
}: {
  formId: string;
  viewer?: string | null;
}) {
  const referrals = useFormReferrals(formId);
  if (referrals.status !== 'success' || referrals.leaderboard.length === 0) return null;
  return (
    <div className="bg-card mt-4 flex w-full max-w-2xl flex-col gap-3 rounded-xl border p-4 shadow-sm">
      <h2 className="flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        <Trophy className="text-primary size-3.5" />
        Top referrers
      </h2>
      <ReferralLeaderboard standings={referrals.leaderboard} limit={TOP} highlight={viewer} />
    </div>
  );
}
