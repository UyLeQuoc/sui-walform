'use client';

import { Check } from 'lucide-react';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { cn } from '../../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import type { WalFormNetwork } from '../providers';

const NETWORKS: WalFormNetwork[] = ['testnet', 'mainnet'];

interface NetworkBadgeProps {
  className?: string;
}

/**
 * Always-visible pill showing the active Sui network. Clicking opens a small
 * menu to flip between testnet ↔ mainnet — works pre-connect, since network
 * is a `SuiClientProvider` concern, not a wallet one. Persists via the same
 * `walform:network` localStorage key the providers seed reads from.
 */
export function NetworkBadge({ className }: NetworkBadgeProps) {
  const { network, selectNetwork } = useSuiClientContext();
  const active = (network === 'mainnet' ? 'mainnet' : 'testnet') as WalFormNetwork;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 inline-flex items-center border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase transition-colors',
            className,
          )}
          aria-label={`Network: ${active}. Click to switch.`}
        >
          <span className="relative mr-1.5 inline-flex h-1.5 w-1.5">
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                active === 'mainnet' ? 'bg-emerald-400' : 'bg-amber-400',
              )}
            />
            <span
              className={cn(
                'relative inline-flex h-1.5 w-1.5 rounded-full',
                active === 'mainnet' ? 'bg-emerald-500' : 'bg-amber-500',
              )}
            />
          </span>
          {active}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Switch network
        </DropdownMenuLabel>
        {NETWORKS.map((net) => {
          const isActive = active === net;
          return (
            <DropdownMenuItem
              key={net}
              onSelect={(e) => {
                e.preventDefault();
                if (!isActive) selectNetwork(net);
              }}
              className="flex items-center gap-2 capitalize"
            >
              <span className="flex-1">{net}</span>
              {isActive && <Check className="text-muted-foreground h-3.5 w-3.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
