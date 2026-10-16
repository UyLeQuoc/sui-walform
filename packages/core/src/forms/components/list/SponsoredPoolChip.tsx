'use client';

import { HandCoins } from 'lucide-react';
import { Badge } from '../../../ui/badge';
import { cn } from '../../../lib/utils';
import { useFormSponsorPool } from '../../hooks/use-form-sponsor-pool';
import { formatAmountShort, formatWal } from '../../lib/sui-amount';

/**
 * Pool status at a glance on a My Forms card. Nothing renders for forms
 * without a pool; a paused or empty pool shows amber so it gets topped up.
 */
export function SponsoredPoolChip({ formId }: { formId: string }) {
  const state = useFormSponsorPool(formId);
  if (state.status !== 'success' || !state.pool) return null;

  const { pool } = state;
  const healthy = pool.enabled && pool.walFrost > 0n;
  const label = !pool.enabled
    ? 'Sponsorship paused'
    : pool.walFrost === 0n
      ? 'Sponsor pool empty'
      : `Sponsored · ${formatAmountShort(pool.walFrost)} WAL`;

  return (
    <Badge
      variant="outline"
      title={`${formatWal(pool.walFrost)} WAL in the storage sponsorship pool`}
      className={cn(
        'gap-1',
        healthy
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      )}
    >
      <HandCoins className="h-3 w-3" />
      {label}
    </Badge>
  );
}
