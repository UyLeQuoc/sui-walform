'use client';

import { useCurrentWallet } from '@mysten/dapp-kit';
import { WalletChip } from './WalletChip';
import { WalletDropdown } from './WalletDropdown';

export function ConnectedIndicator() {
  const { isConnected } = useCurrentWallet();
  if (!isConnected) return null;
  return (
    <WalletDropdown align="end">
      <WalletChip />
    </WalletDropdown>
  );
}
