'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Check, Copy, LogOut, Network, ShieldCheck } from 'lucide-react';
import { useDisconnectWallet, useSuiClientContext } from '@mysten/dapp-kit';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { useIsPlatformAdmin } from '../use-platform-admin';
import type { WalFormNetwork } from '../providers';
import { useWalletAddress } from './useWalletAddress';

interface WalletDropdownProps {
  align?: 'start' | 'end' | 'center';
  children: ReactNode;
}

const NETWORKS: WalFormNetwork[] = ['testnet', 'mainnet'];

export function WalletDropdown({ align = 'end', children }: WalletDropdownProps) {
  const { address, short } = useWalletAddress();
  const { mutate: disconnect } = useDisconnectWallet();
  const { isAdmin } = useIsPlatformAdmin();
  const { network, selectNetwork } = useSuiClientContext();

  if (!address || !short) return null;

  const copyAddress = () => {
    void navigator.clipboard
      .writeText(address)
      .then(() => toast.success('Address copied'))
      .catch(() => toast.error('Clipboard unavailable'));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            copyAddress();
          }}
          className="flex items-center gap-2"
        >
          <code className="flex-1 font-mono text-xs">{short}</code>
          <Copy className="text-muted-foreground h-3.5 w-3.5" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground flex items-center gap-2 text-xs font-normal">
          <Network className="h-3.5 w-3.5" />
          <span>Network</span>
        </DropdownMenuLabel>
        {NETWORKS.map((net) => {
          const active = network === net;
          return (
            <DropdownMenuItem
              key={net}
              onSelect={(e) => {
                e.preventDefault();
                if (!active) selectNetwork(net);
              }}
              className="flex items-center gap-2 capitalize"
            >
              <span className="flex-1">{net}</span>
              {active && <Check className="text-muted-foreground h-3.5 w-3.5" />}
            </DropdownMenuItem>
          );
        })}
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin" className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Platform admin</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => disconnect()}
          className="flex items-center gap-2"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
