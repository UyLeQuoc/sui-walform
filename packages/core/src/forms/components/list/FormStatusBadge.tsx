'use client';

import { Badge } from '../../../ui/badge';
import { cn } from '../../../lib/utils';
import { FORM_STATUS_LABEL, type FormStatus } from '../../lib/form-status';

interface FormStatusBadgeProps {
  status: FormStatus;
  className?: string;
}

/**
 * Single source of truth for form status visuals. `live` and `full` need
 * colors outside the shadcn badge palette, so they ride on top of `outline`
 * with explicit Tailwind tokens; the rest map cleanly onto existing variants.
 */
export function FormStatusBadge({ status, className }: FormStatusBadgeProps) {
  const label = FORM_STATUS_LABEL[status];
  if (status === 'closed') {
    return (
      <Badge variant="destructive" className={className}>
        {label}
      </Badge>
    );
  }
  if (status === 'live') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          className,
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
        {label}
      </Badge>
    );
  }
  if (status === 'full') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
          className,
        )}
      >
        {label}
      </Badge>
    );
  }
  // draft + ended share the muted secondary look.
  return (
    <Badge variant="secondary" className={className}>
      {label}
    </Badge>
  );
}
