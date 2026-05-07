'use client';

import type { ReactNode } from 'react';
import { Copy, LogOut } from 'lucide-react';
import { useDisconnectWallet } from '@mysten/dapp-kit';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { useWalletAddress } from './useWalletAddress';

interface WalletDropdownProps {
  align?: 'start' | 'end' | 'center';
  children: ReactNode;
}

export function WalletDropdown({ align = 'end', children }: WalletDropdownProps) {
  const { address, short } = useWalletAddress();
  const { mutate: disconnect } = useDisconnectWallet();

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
