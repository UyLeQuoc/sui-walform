'use client';

import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { Card, CardContent } from '../../../ui/card';
import { Skeleton } from '../../../ui/skeleton';
import type { UseFormReferralsResult } from '../../hooks/use-form-referrals';
import { referredPeopleCount } from '../../lib/referrals';
import { ReferralLeaderboard } from '../referrals/ReferralLeaderboard';
import { ReferrerName } from '../referrals/ReferrerName';
import { StatTile } from './StatTile';

interface ReferralsPanelProps {
  referrals: UseFormReferralsResult;
  /** Referral links are switched on for this form. */
  enabled: boolean;
  /** The leaderboard is also shown on the public form page. */
  isPublic: boolean;
  totalSubmissions: number;
}

/** Results → Referrals: who brought in how many submissions. */
export function ReferralsPanel({
  referrals,
  enabled,
  isPublic,
  totalSubmissions,
}: ReferralsPanelProps) {
  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-5 p-5">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <UserPlus className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Referrals</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {enabled
                ? 'Each respondent gets a personal link after submitting. Referrals are recorded on-chain, so the counts are verifiable.'
                : 'Referral links are off. Turn them on in the editor (Submit button → Referral links) and update the form.'}
            </p>
          </div>
          {enabled && (
            <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
              {isPublic ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              {isPublic ? 'Public on form page' : 'Only you see this'}
            </span>
          )}
        </div>

        {referrals.status === 'loading' && <Skeleton className="h-28 w-full rounded-lg" />}
        {referrals.status === 'error' && (
          <p className="text-destructive text-xs">
            Couldn&apos;t load referrals: {referrals.error.message}
          </p>
        )}
        {referrals.status === 'success' && referrals.records.length === 0 && (
          <p className="bg-muted/50 text-muted-foreground rounded-lg px-3 py-2.5 text-xs">
            No one has joined through a referral link yet.
          </p>
        )}
        {referrals.status === 'success' && referrals.records.length > 0 && (
          <ReferralStats
            people={referredPeopleCount(referrals.records)}
            submissions={referrals.records.length}
            referrers={referrals.leaderboard.length}
            top={referrals.leaderboard[0]?.referrer ?? null}
            totalSubmissions={totalSubmissions}
          />
        )}
        {referrals.status === 'success' && referrals.leaderboard.length > 0 && (
          <div className="flex flex-col gap-2">
            <ReferralLeaderboard standings={referrals.leaderboard} detailed />
            <p className="text-muted-foreground text-[11px]">
              Ranked by people brought in. Open a row to see who they invited.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReferralStats({
  people,
  submissions,
  referrers,
  top,
  totalSubmissions,
}: {
  people: number;
  submissions: number;
  referrers: number;
  top: string | null;
  totalSubmissions: number;
}) {
  const share = totalSubmissions > 0 ? Math.round((submissions / totalSubmissions) * 100) : 0;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <StatTile
        label="People referred"
        value={String(people)}
        hint={`${submissions} submission${submissions === 1 ? '' : 's'} · ${share}% of all`}
      />
      <StatTile label="Referrers" value={String(referrers)} />
      <div className="bg-card flex flex-col gap-0.5 rounded-lg border p-3">
        <span className="text-muted-foreground text-xs">Top referrer</span>
        {top ? (
          <ReferrerName address={top} className="text-lg font-semibold" />
        ) : (
          <span className="text-lg font-semibold">-</span>
        )}
      </div>
    </div>
  );
}
