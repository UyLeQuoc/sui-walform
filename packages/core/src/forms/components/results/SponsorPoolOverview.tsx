'use client';

import { useState, type ReactNode } from 'react';
import { ArrowDownToLine, CircleAlert, Pause, Play, Plus } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Separator } from '../../../ui/separator';
import { Spinner } from '../../../ui/spinner';
import {
  formatAmountShort,
  formatSui,
  formatWal,
  suiToMist,
  walToFrost,
} from '../../lib/sui-amount';
import { SponsorFundingFields } from './SponsorFundingFields';
import { StatTile } from './StatTile';
import type { SponsorPoolState } from '../../../types';

/** Below this many uploads left, the balance tile turns amber. */
const LOW_BALANCE_UPLOADS = 5n;

interface SponsorPoolOverviewProps {
  pool: SponsorPoolState;
  feeBps: bigint | null;
  isMutating: boolean;
  onFund: (funding: { walFrost: bigint; suiMist: bigint }) => void;
  onSetEnabled: (enabled: boolean) => void;
  onWithdrawAll: () => void;
}

/** A funded pool: balances, usage, top-up, pause and withdraw. */
export function SponsorPoolOverview({
  pool,
  feeBps,
  isMutating,
  onFund,
  onSetEnabled,
  onWithdrawAll,
}: SponsorPoolOverviewProps) {
  const [wal, setWal] = useState('1');
  const [sui, setSui] = useState('0.05');
  const funding = { walFrost: walToFrost(Number(wal)), suiMist: suiToMist(Number(sui)) };

  const avgSpent = pool.totalUploads > 0n ? pool.totalWalSpent / pool.totalUploads : null;
  const avgCharged = avgSpent === null ? null : avgSpent + (avgSpent * (feeBps ?? 0n)) / 10_000n;
  const uploadsLeft = avgCharged && avgCharged > 0n ? pool.walFrost / avgCharged : null;
  const empty = pool.walFrost === 0n && pool.suiMist === 0n;

  return (
    <div className="flex flex-col gap-5">
      {!pool.enabled && (
        <Notice>Paused - respondents pay their own storage until you resume.</Notice>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="WAL balance"
          value={formatAmountShort(pool.walFrost)}
          exact={`${formatWal(pool.walFrost)} WAL`}
          hint={uploadsLeft === null ? 'No uploads yet' : `≈ ${uploadsLeft} uploads left`}
          warn={uploadsLeft !== null && uploadsLeft < LOW_BALANCE_UPLOADS}
        />
        <StatTile
          label="SUI for tips"
          value={formatAmountShort(pool.suiMist)}
          exact={`${formatSui(pool.suiMist)} SUI`}
        />
        <StatTile label="Sponsored uploads" value={pool.totalUploads.toString()} />
        <StatTile
          label="WAL spent"
          value={formatAmountShort(pool.totalWalSpent)}
          exact={`${formatWal(pool.totalWalSpent)} WAL`}
          hint={avgSpent === null ? undefined : `avg ${formatAmountShort(avgSpent, 5)} / upload`}
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-medium">Top up</h4>
        <SponsorFundingFields wal={wal} sui={sui} onWalChange={setWal} onSuiChange={setSui} />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSetEnabled(!pool.enabled)}
            disabled={isMutating}
          >
            {pool.enabled ? (
              <Pause className="mr-1.5 size-3.5" />
            ) : (
              <Play className="mr-1.5 size-3.5" />
            )}
            {pool.enabled ? 'Pause' : 'Resume'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onWithdrawAll}
            disabled={isMutating || empty}
            className="text-muted-foreground"
          >
            <ArrowDownToLine className="mr-1.5 size-3.5" />
            Withdraw all
          </Button>
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => onFund(funding)}
            disabled={isMutating || (funding.walFrost === 0n && funding.suiMist === 0n)}
          >
            {isMutating ? (
              <Spinner className="mr-1.5 size-3.5" />
            ) : (
              <Plus className="mr-1.5 size-3.5" />
            )}
            Add funds
          </Button>
        </div>
      </div>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
