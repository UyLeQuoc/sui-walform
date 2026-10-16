'use client';

import { cn } from '../../../lib/utils';

interface StatTileProps {
  label: string;
  value: string;
  /** Exact value, shown on hover when `value` is rounded. */
  exact?: string;
  hint?: string;
  warn?: boolean;
}

/** One number in a panel's stat grid; `warn` turns it amber. */
export function StatTile({ label, value, exact, hint, warn }: StatTileProps) {
  return (
    <div
      title={exact}
      className={cn(
        'bg-card flex flex-col gap-0.5 rounded-lg border p-3',
        warn && 'border-amber-500/40',
      )}
    >
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {hint && (
        <span
          className={cn(
            'text-[11px]',
            warn ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
          )}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
