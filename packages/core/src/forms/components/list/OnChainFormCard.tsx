'use client';

import { Link } from 'react-router-dom';
import { BarChart3, CalendarClock, ChevronRight, Coins, Globe, Lock, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '../../../ui/badge';
import { Card, CardContent } from '../../../ui/card';
import { cn } from '../../../lib/utils';
import { deriveOnChainStatus, type FormStatus } from '../../lib/form-status';
import { formsRoute } from '../../lib/routes';
import type { OnChainForm } from '../../hooks/use-on-chain-forms';
import { FormStatusBadge } from './FormStatusBadge';

interface OnChainFormCardProps {
  form: OnChainForm;
}

const ACCESS_META: Record<number, { label: string; icon: LucideIcon }> = {
  0: { label: 'Public', icon: Globe },
  1: { label: 'Allowlist', icon: Users },
  2: { label: 'Token-gated', icon: Lock },
  3: { label: 'Paid', icon: Coins },
};

const STRIPE_BY_STATUS: Record<FormStatus, string> = {
  live: 'from-emerald-500/30 via-emerald-500/10 to-transparent',
  full: 'from-amber-500/30 via-amber-500/10 to-transparent',
  closed: 'from-red-500/25 via-red-500/10 to-transparent',
  ended: 'from-muted-foreground/20 via-muted-foreground/5 to-transparent',
  draft: 'from-muted-foreground/15 via-muted-foreground/5 to-transparent',
};

/**
 * On-chain form card: header banner shows the response metric over a
 * status-tinted gradient; body lists access mode + deadline; footer carries
 * the status pill + chevron. Whole card is a link to /forms/results?formId=…
 */
export function OnChainFormCard({ form }: OnChainFormCardProps) {
  const status = deriveOnChainStatus(form);
  const capLabel = form.maxSubmissions === 0 ? '∞' : form.maxSubmissions;
  const access = ACCESS_META[form.accessMode] ?? { label: 'Unknown', icon: Globe };
  const AccessIcon = access.icon;
  const deadline =
    form.closesAtMs === 0
      ? 'No deadline'
      : `Closes ${formatDistanceToNow(form.closesAtMs, { addSuffix: true })}`;
  const fill =
    form.maxSubmissions > 0
      ? Math.min(100, Math.round((form.submissionCount / form.maxSubmissions) * 100))
      : null;

  return (
    <Link
      to={formsRoute.results(form.formId)}
      aria-label={`Open analytics for ${form.title}`}
      className="focus-visible:ring-ring group block rounded-4xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <Card className="cursor-pointer pt-0 transition-shadow hover:shadow-lg">
        <div className="relative flex h-28 items-center justify-between overflow-hidden px-5">
          {form.coverImage ? (
            <>
              <img
                src={form.coverImage}
                alt=""
                aria-hidden
                className="absolute inset-0 size-full object-cover"
              />
              {/* Fade the image out from right to left so the metric text on
                  the left sits over the card background, while the image
                  remains crisp on the right. */}
              <div className="from-card via-card/80 absolute inset-0 bg-gradient-to-r to-transparent" />
            </>
          ) : (
            <div
              aria-hidden
              className={cn('absolute inset-0 bg-gradient-to-br', STRIPE_BY_STATUS[status])}
            />
          )}
          <div className="relative flex flex-col">
            <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px] font-medium tracking-wide uppercase">
              <BarChart3 className="h-3 w-3" />
              Responses
            </span>
            <span className="text-foreground text-3xl font-semibold tabular-nums">
              {form.submissionCount}
              <span className="text-muted-foreground ml-1 text-base font-normal">/ {capLabel}</span>
            </span>
          </div>
          {fill !== null && !form.coverImage && (
            <div
              className="relative flex flex-col items-end gap-1"
              aria-label={`${fill}% of capacity used`}
            >
              <span className="text-muted-foreground text-[11px] font-medium tabular-nums">
                {fill}%
              </span>
              <div className="bg-background/60 h-1.5 w-16 overflow-hidden rounded-full">
                <div
                  className="bg-foreground/70 h-full rounded-full"
                  style={{ width: `${fill}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <CardContent className="flex flex-col gap-3 px-5">
          <h3 className="line-clamp-2 text-base font-semibold">{form.title}</h3>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="gap-1">
              <AccessIcon className="h-3 w-3" />
              {access.label}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <CalendarClock className="h-3 w-3" />
              {deadline}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <FormStatusBadge status={status} />
            <ChevronRight className="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
