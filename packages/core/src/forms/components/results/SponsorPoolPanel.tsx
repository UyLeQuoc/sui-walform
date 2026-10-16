'use client';

import { HandCoins } from 'lucide-react';
import { Badge } from '../../../ui/badge';
import { Card, CardContent } from '../../../ui/card';
import { Skeleton } from '../../../ui/skeleton';
import { useActiveNetwork } from '../../../sui/env-network';
import { isGasSponsored } from '../../../sui/use-execute-transaction';
import { useFormSponsorPool, useSponsorConfig } from '../../hooks/use-form-sponsor-pool';
import { useSponsorPoolActions } from '../../hooks/use-sponsor-pool-actions';
import { SponsorPoolOverview } from './SponsorPoolOverview';
import { SponsorPoolSetup } from './SponsorPoolSetup';

interface SponsorPoolPanelProps {
  formId: string;
  /** FormOwnerCap id — required to open, withdraw, or pause the pool. */
  capId: string;
}

type PanelStatus = 'unavailable' | 'loading' | 'error' | 'setup' | 'active' | 'paused';

/**
 * Creator-funded Walrus storage for respondents: open and fund a pool, watch
 * its balance, top it up, and pause it. Extending what's already stored is
 * separate — `FormStoragePanel` — and works whoever paid.
 * Respondents still sign their own uploads (their address on Walruscan); the
 * pool pays the storage + relay tips, and the gas sponsor covers SUI gas.
 */
export function SponsorPoolPanel({ formId, capId }: SponsorPoolPanelProps) {
  const network = useActiveNetwork();
  const poolState = useFormSponsorPool(formId);
  const configState = useSponsorConfig();
  const pool = poolState.status === 'success' ? poolState.pool : null;
  const feeBps = configState.status === 'success' ? configState.config.feeBps : null;
  const actions = useSponsorPoolActions({ capId, pool });
  const gasCovered = !!network && isGasSponsored(network);

  const status: PanelStatus =
    poolState.status === 'success'
      ? !pool
        ? 'setup'
        : pool.enabled
          ? 'active'
          : 'paused'
      : poolState.status;

  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-5 p-5">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <HandCoins className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">Storage sponsorship</h3>
              <StatusBadge status={status} />
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {gasCovered
                ? 'Respondents submit without WAL or SUI - this form pays their storage, WalForm pays the gas.'
                : 'Respondents submit without WAL - this form pays their Walrus storage.'}
            </p>
          </div>
        </div>

        {status === 'unavailable' && (
          <p className="bg-muted/50 text-muted-foreground rounded-lg px-3 py-2.5 text-xs">
            Sponsored storage isn&apos;t live on{' '}
            {network === 'mainnet' ? 'Mainnet' : 'this network'} yet. Switch to Testnet in the
            header to try it.
          </p>
        )}
        {status === 'loading' && <Skeleton className="h-28 w-full rounded-lg" />}
        {poolState.status === 'error' && (
          <p className="text-destructive text-xs">
            Couldn&apos;t load sponsorship: {poolState.error.message}
          </p>
        )}
        {status === 'setup' && (
          <SponsorPoolSetup
            feePct={feeBps === null ? null : Number(feeBps) / 100}
            gasCovered={gasCovered}
            isMutating={actions.isMutating}
            onOpen={actions.open}
          />
        )}
        {pool && (
          <SponsorPoolOverview
            pool={pool}
            feeBps={feeBps}
            isMutating={actions.isMutating}
            onFund={actions.fund}
            onSetEnabled={actions.setEnabled}
            onWithdrawAll={actions.withdrawAll}
          />
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: PanelStatus }) {
  if (status === 'active') {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      >
        <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
        Active
      </Badge>
    );
  }
  if (status === 'paused') {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      >
        Paused
      </Badge>
    );
  }
  if (status === 'setup') return <Badge variant="secondary">Not set up</Badge>;
  if (status === 'unavailable') return <Badge variant="outline">Testnet only</Badge>;
  return null;
}
