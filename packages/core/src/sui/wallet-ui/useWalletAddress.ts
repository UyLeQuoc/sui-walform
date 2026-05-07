'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';

export function truncateAddress(addr: string, head = 6, tail = 4): string {
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function useWalletAddress() {
  const account = useCurrentAccount();
  return {
    account,
    address: account?.address ?? null,
    short: account?.address ? truncateAddress(account.address, 6, 4) : null,
  };
}
