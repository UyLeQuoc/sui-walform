'use client';

import { Check, CircleDashed, X } from 'lucide-react';
import { Spinner } from '../../../ui/spinner';
import { cn } from '../../../lib/utils';

export type StepStatus = 'pending' | 'active' | 'done' | 'error';

export interface TxStep {
  id: string;
  label: string;
  status: StepStatus;
  /** Optional sub-text shown beneath the label when this is the active step. */
  detail?: string;
}

interface TxStepsProps {
  steps: TxStep[];
  className?: string;
}

/**
 * Compact vertical step indicator used by both the publish flow and the
 * submit flow. Each step shows its own icon (pending/active/done/error)
 * and only the active step expands its `detail` line — keeps the indicator
 * dense without sacrificing context. Designed for inline placement, not as
 * a floating toast.
 */
export function TxSteps({ steps, className }: TxStepsProps) {
  return (
    <ol className={cn('flex flex-col gap-2', className)}>
      {steps.map((step) => (
        <li key={step.id} className="flex items-start gap-2.5">
          <StepIcon status={step.status} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span
              className={cn(
                'text-sm leading-tight transition-colors',
                step.status === 'active' && 'text-foreground font-medium',
                step.status === 'done' && 'text-muted-foreground',
                step.status === 'pending' && 'text-muted-foreground/60',
                step.status === 'error' && 'text-destructive font-medium',
              )}
            >
              {step.label}
            </span>
            {step.status === 'active' && step.detail && (
              <span className="text-muted-foreground mt-0.5 text-xs">{step.detail}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <span className="bg-primary/15 text-primary mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full">
        <Check className="size-2.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="text-primary mt-0.5 inline-flex size-4 shrink-0 items-center justify-center">
        <Spinner className="size-3.5" />
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="bg-destructive/15 text-destructive mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full">
        <X className="size-2.5" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="text-muted-foreground/40 mt-0.5 inline-flex size-4 shrink-0 items-center justify-center">
      <CircleDashed className="size-3.5" />
    </span>
  );
}
