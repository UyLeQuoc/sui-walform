'use client';

import { HandCoins } from 'lucide-react';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { isGasSponsored } from '../../../sui/use-execute-transaction';
import { useFormSponsorPool } from '../../hooks/use-form-sponsor-pool';
import type { FormOnChainDetail } from '../../hooks/use-form-on-chain';

/**
 * Tells respondents up front that submitting is free — the creator pays their
 * Walrus storage and (where configured) WalForm's gas sponsor pays the gas —
 * so an empty wallet isn't a reason to give up. Shown only while the pool is
 * live and funded; paid forms never use the pool.
 */
export function SponsoredStorageBanner({ form }: { form: FormOnChainDetail }) {
  const { network } = useSuiClientContext();
  const pool = useFormSponsorPool(form.accessMode === 3 ? undefined : form.formObjectId);
  if (pool.status !== 'success' || !pool.pool?.enabled || pool.pool.walFrost === 0n) return null;
  // Storage (WAL) comes from the creator's pool; gas (SUI) from WalForm's gas
  // sponsor — only promise "no SUI" where that sponsor is configured.
  const gasCovered = isGasSponsored(network);

  return (
    <div className="flex items-center gap-2 border-b bg-emerald-500/5 px-6 py-3 text-xs">
      <HandCoins className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span>
        <span className="font-medium text-emerald-700 dark:text-emerald-300">
          {gasCovered ? 'Free to submit' : 'Storage sponsored'}
        </span>
        <span className="text-muted-foreground">
          {gasCovered
            ? ' - no WAL or SUI needed. The creator pays to store your response; WalForm covers the network fee.'
            : " - the creator pays for storing your response. You don't need WAL to submit."}
        </span>
      </span>
    </div>
  );
}
