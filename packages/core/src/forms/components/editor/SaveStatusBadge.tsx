'use client';

import { cn } from '../../../lib/utils';
import type { SaveStatus } from '../../hooks/use-auto-save';

interface SaveStatusBadgeProps {
  status: SaveStatus;
}

const STATUS_LABEL: Record<Exclude<SaveStatus, 'idle'>, string> = {
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
  conflict: 'Edited in another tab — reload',
};

export function SaveStatusBadge({ status }: SaveStatusBadgeProps) {
  if (status === 'idle') return null;

  return (
    <span
      className={cn(
        'text-xs font-medium transition-colors',
        status === 'saving' && 'text-muted-foreground',
        status === 'saved' && 'text-green-600 dark:text-green-400',
        status === 'error' && 'text-destructive',
        status === 'conflict' && 'text-amber-600 dark:text-amber-400',
      )}
      title={
        status === 'conflict'
          ? 'Another tab edited this form. Reload to continue editing.'
          : undefined
      }
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
