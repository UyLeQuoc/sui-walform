'use client';

import { Flag } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  type SubmissionPriority,
  type SubmissionStatus,
} from '../../services/submission-tags-db';

const STATUS_CLASS: Record<SubmissionStatus, string> = {
  new: 'bg-secondary text-secondary-foreground',
  acked: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  in_progress: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  resolved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  closed: 'bg-muted text-muted-foreground',
  spam: 'bg-destructive/15 text-destructive',
};

const PRIORITY_CLASS: Record<SubmissionPriority, string> = {
  none: 'text-muted-foreground',
  low: 'text-emerald-600 dark:text-emerald-400',
  med: 'text-amber-600 dark:text-amber-400',
  high: 'text-orange-600 dark:text-orange-400',
  urgent: 'text-red-600 dark:text-red-400',
};

interface StatusPillProps {
  value: SubmissionStatus;
  onChange: (next: SubmissionStatus) => void;
}

export function StatusPill({ value, onChange }: StatusPillProps) {
  const label = STATUS_OPTIONS.find((s) => s.value === value)?.label ?? value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
          STATUS_CLASS[value],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {STATUS_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => onChange(opt.value)}
            className={cn(opt.value === value && 'font-semibold')}
          >
            <span
              className={cn(
                'mr-2 inline-block size-2 rounded-full',
                STATUS_CLASS[opt.value].split(' ')[0],
              )}
            />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface PriorityPillProps {
  value: SubmissionPriority;
  onChange: (next: SubmissionPriority) => void;
}

export function PriorityPill({ value, onChange }: PriorityPillProps) {
  const label = PRIORITY_OPTIONS.find((p) => p.value === value)?.label ?? value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
          PRIORITY_CLASS[value],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Flag className="h-3 w-3" />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {PRIORITY_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => onChange(opt.value)}
            className={cn(opt.value === value && 'font-semibold')}
          >
            <Flag className={cn('mr-2 h-3.5 w-3.5', PRIORITY_CLASS[opt.value])} />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
