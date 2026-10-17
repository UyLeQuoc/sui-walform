'use client';

import { ExternalLink } from 'lucide-react';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { suivisionUrl, type ExplorerNetwork } from '../../../sui/explorer';
import { useSuinsName } from '../../hooks/use-suins-name';
import { shortAddr } from '../../lib/format-address';
import { cn } from '../../../lib/utils';

/**
 * A referrer as their SuiNS name when they have one, else a short address —
 * linked to their Suivision account page so it's clear who it is.
 */
export function ReferrerName({ address, className }: { address: string; className?: string }) {
  const name = useSuinsName(address);
  const { network } = useSuiClientContext();
  const explorer: ExplorerNetwork =
    network === 'mainnet' || network === 'devnet' ? network : 'testnet';
  return (
    <a
      href={suivisionUrl(explorer, 'account', address)}
      target="_blank"
      rel="noopener noreferrer"
      title={`${address} - view on Suivision`}
      // Rows that open a detail view on click shouldn't also open it here.
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'hover:text-foreground inline-flex max-w-full min-w-0 items-center gap-1 underline-offset-2 hover:underline',
        className,
      )}
    >
      <span className={cn('truncate', !name && 'font-mono')}>{name ?? shortAddr(address)}</span>
      <ExternalLink className="size-3 shrink-0 opacity-60" />
    </a>
  );
}
