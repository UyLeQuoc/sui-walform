'use client';

import Link from 'next/link';
import { CalendarClock, ChevronRight, Eye, Globe, Lock, Coins, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '../../../ui/badge';
import { Card, CardContent } from '../../../ui/card';
import { shortAddr } from '../../lib/format-address';
import { deriveOnChainStatus } from '../../lib/form-status';
import { formsRoute } from '../../lib/routes';
import type { ReviewingForm } from '../../hooks/use-reviewing-forms';
import { FormStatusBadge } from './FormStatusBadge';

interface ReviewingFormCardProps {
  form: ReviewingForm;
}

const ACCESS_META: Record<number, { label: string; icon: LucideIcon }> = {
  0: { label: 'Public', icon: Globe },
  1: { label: 'Allowlist', icon: Users },
  2: { label: 'Token-gated', icon: Lock },
  3: { label: 'Paid', icon: Coins },
};

/**
 * Card for forms where the connected wallet is a reviewer (not the owner).
 * Read-only: links to `/forms/results?formId=…` where the reviewer can decrypt
 * submissions via the with-reviewers Seal policy. No manage controls.
 */
export function ReviewingFormCard({ form }: ReviewingFormCardProps) {
  const status = deriveOnChainStatus(form);
  const access = ACCESS_META[form.accessMode] ?? { label: 'Unknown', icon: Globe };
  const AccessIcon = access.icon;
  const deadline =
    form.closesAtMs === 0
      ? 'No deadline'
      : `Closes ${formatDistanceToNow(form.closesAtMs, { addSuffix: true })}`;

  return (
    <Link
      href={formsRoute.results(form.formId)}
      aria-label={`Review submissions for ${form.title}`}
      className="focus-visible:ring-ring group block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <Card className="hover:border-foreground/20 cursor-pointer transition-colors">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 min-w-0 flex-1 truncate text-sm font-semibold">
              {form.title}
            </h3>
            <FormStatusBadge status={status} />
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            <Badge variant="outline" className="gap-1">
              <Eye className="h-3 w-3" />
              Reviewer
            </Badge>
            <Badge variant="outline" className="gap-1">
              <AccessIcon className="h-3 w-3" />
              {access.label}
            </Badge>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {deadline}
            </span>
            <span>
              {form.submissionCount} {form.submissionCount === 1 ? 'response' : 'responses'}
            </span>
          </div>

          <div className="text-muted-foreground flex items-center justify-between gap-2 text-[11px]">
            <span title={form.owner}>
              owner <span className="font-mono">{shortAddr(form.owner)}</span>
            </span>
            <ChevronRight className="text-muted-foreground/60 group-hover:text-foreground h-4 w-4 transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
