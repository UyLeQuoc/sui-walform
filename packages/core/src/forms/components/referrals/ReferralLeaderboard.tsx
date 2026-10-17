'use client';

import { ChevronDown } from 'lucide-react';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../ui/collapsible';
import { formatRelative } from '../../lib/format-relative-time';
import { cn } from '../../../lib/utils';
import type { ReferrerStanding } from '../../../types';
import { ReferrerName } from './ReferrerName';

interface ReferralLeaderboardProps {
  standings: ReferrerStanding[];
  /** Show only the top N. */
  limit?: number;
  /** Address to highlight (the viewer). */
  highlight?: string | null;
  /** Creator view: submission counts, and each row expands to who they invited. */
  detailed?: boolean;
}

/** Ranked referrers: position, name, people brought in. */
export function ReferralLeaderboard({
  standings,
  limit,
  highlight,
  detailed = false,
}: ReferralLeaderboardProps) {
  const rows = limit ? standings.slice(0, limit) : standings;
  const me = highlight ? normalizeSuiAddress(highlight) : null;
  return (
    <ol className="flex flex-col divide-y rounded-lg border">
      {rows.map((s, i) => (
        <li key={s.referrer} className={cn(s.referrer === me && 'bg-primary/5')}>
          <Collapsible>
            <div className="flex items-center gap-3 px-3 py-2 text-sm">
              <span
                className={cn(
                  'text-muted-foreground w-5 text-right text-xs tabular-nums',
                  i < 3 && 'text-foreground font-semibold',
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <ReferrerName address={s.referrer} />
              </div>
              {s.referrer === me && <span className="text-primary text-xs">You</span>}
              {detailed && s.submissions > s.people && (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {s.submissions} submissions
                </span>
              )}
              {detailed ? (
                <CollapsibleTrigger
                  aria-label={`Show the ${s.people} ${s.people === 1 ? 'person' : 'people'} they invited`}
                  className="hover:bg-muted group flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold tabular-nums"
                >
                  {s.people}
                  <ChevronDown className="text-muted-foreground size-3.5 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
              ) : (
                <span className="font-semibold tabular-nums">{s.people}</span>
              )}
            </div>
            {detailed && (
              <CollapsibleContent>
                <ul className="bg-muted/30 flex flex-col gap-1.5 border-t py-2 pr-3 pl-11">
                  {s.invited.map((p) => (
                    <li key={p.address} className="flex items-center gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <ReferrerName address={p.address} />
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        {p.submissions > 1 ? `${p.submissions} submissions · ` : ''}
                        {formatRelative(p.lastReferredAtMs)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            )}
          </Collapsible>
        </li>
      ))}
    </ol>
  );
}
