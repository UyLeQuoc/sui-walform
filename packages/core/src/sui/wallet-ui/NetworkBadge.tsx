'use client';

import { useSuiClientContext } from '@mysten/dapp-kit';
import { cn } from '../../lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import type { WalFormNetwork } from '../providers';

const NETWORKS: WalFormNetwork[] = ['testnet', 'mainnet'];

interface NetworkBadgeProps {
  className?: string;
}

/**
 * Always-visible dropdown showing the active Sui network. Flips between
 * testnet ↔ mainnet pre-connect — network is a `SuiClientProvider` concern,
 * not a wallet one. Persists via the `walform:network` localStorage key the
 * providers seed reads from.
 */
export function NetworkBadge({ className }: NetworkBadgeProps) {
  const { network, selectNetwork } = useSuiClientContext();
  const active = (network === 'mainnet' ? 'mainnet' : 'testnet') as WalFormNetwork;

  return (
    <Select value={active} onValueChange={(value) => selectNetwork(value as WalFormNetwork)}>
      <SelectTrigger
        aria-label={`Network: ${active}. Click to switch.`}
        className={cn('bg-background hover:bg-muted border-input capitalize', className)}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping opacity-60',
              active === 'mainnet' ? 'bg-emerald-400' : 'bg-amber-400',
            )}
          />
          <span
            className={cn(
              'relative inline-flex h-2 w-2',
              active === 'mainnet' ? 'bg-emerald-500' : 'bg-amber-500',
            )}
          />
        </span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[8rem]">
        {NETWORKS.map((net) => (
          <SelectItem key={net} value={net} className="capitalize">
            {net}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
