'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { Button } from '../../ui/button';
import { WalletChip } from './WalletChip';
import { WalletConnectModal } from './WalletConnectModal';
import { WalletDropdown } from './WalletDropdown';

/**
 * Single header entry point for wallet state. Disconnected → shows a
 * "Connect wallet" CTA that opens the connect modal. Connected → shows
 * the WalletChip wrapped in the WalletDropdown so the user gets
 * address + Copy + Disconnect from one place.
 */
export function WalletButton() {
  const { isConnected } = useCurrentWallet();
  const [connectOpen, setConnectOpen] = useState(false);

  if (isConnected) {
    return (
      <WalletDropdown align="end">
        <WalletChip />
      </WalletDropdown>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setConnectOpen(true)} className="px-2.5 sm:px-4">
        <Wallet className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">Connect wallet</span>
      </Button>
      <WalletConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
    </>
  );
}
