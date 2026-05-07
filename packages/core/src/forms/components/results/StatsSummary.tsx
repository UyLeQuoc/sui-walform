'use client';

import { type ReactNode } from 'react';
import { Users } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { formatRelative } from '../../lib/format-relative-time';

interface StatsSummaryProps {
  total: number;
  decrypted: number;
  uniqueSubmitters: number;
  /** Latest submission timestamp in ms, or 0 when there are no submissions. */
  latestMs: number;
}

export function StatsSummary({ total, decrypted, uniqueSubmitters, latestMs }: StatsSummaryProps) {
  const pct = total === 0 ? 0 : Math.round((decrypted / total) * 100);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCard label="Responses" value={total.toString()} />
      <StatCard
        label="Decrypted"
        value={total === 0 ? '0' : `${decrypted}/${total}`}
        hint={total > 0 ? `${pct}% revealed` : undefined}
        accent={total > 0 && decrypted < total ? 'warn' : undefined}
      />
      <StatCard
        label="Unique submitters"
        value={uniqueSubmitters.toString()}
        icon={<Users className="text-muted-foreground h-3.5 w-3.5" />}
      />
      <StatCard label="Latest response" value={latestMs > 0 ? formatRelative(latestMs) : '—'} />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accent?: 'warn';
}

function StatCard({ label, value, hint, icon, accent }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-card flex flex-col gap-0.5 rounded-lg border p-3',
        accent === 'warn' && 'border-amber-500/40',
      )}
    >
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        {icon}
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-muted-foreground text-[11px]">{hint}</span>}
    </div>
  );
}
