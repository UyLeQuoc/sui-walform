'use client';

import { useEffect } from 'react';
import { useConnectWallet, useCurrentAccount, useWallets } from '@mysten/dapp-kit';

type Wallet = ReturnType<typeof useWallets>[number];
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Spinner } from '../../ui/spinner';

interface WalletConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: (address: string) => void;
}

export function WalletConnectModal({ open, onOpenChange, onConnected }: WalletConnectModalProps) {
  const wallets = useWallets();
  const { mutate: connect, isPending, variables: pendingVars } = useConnectWallet();
  const account = useCurrentAccount();

  useEffect(() => {
    if (!open) return;
    if (!account) return;
    onOpenChange(false);
    onConnected?.(account.address);
  }, [account?.address, open, onOpenChange, onConnected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect wallet</DialogTitle>
          <DialogDescription>
            Pick any Sui wallet to publish and manage your forms. Sign in with Google uses Enoki
            zkLogin — no extension required.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {wallets.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No Sui wallets detected. Install Slush or Sui Wallet to continue.
            </p>
          )}
          {wallets.map((wallet) => (
            <WalletRow
              key={wallet.name}
              wallet={wallet}
              onSelect={() => connect({ wallet })}
              isPending={isPending && pendingVars?.wallet?.name === wallet.name}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WalletRow({
  wallet,
  onSelect,
  isPending,
}: {
  wallet: Wallet;
  onSelect: () => void;
  isPending: boolean;
}) {
  return (
    <Button
      variant="ghost"
      className="h-12 w-full justify-start gap-3 px-3 text-sm"
      onClick={onSelect}
      disabled={isPending}
    >
      {wallet.icon ? (
        <img
          src={wallet.icon}
          alt=""
          className="h-6 w-6 rounded-md"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <span className="bg-muted h-6 w-6 rounded-md" />
      )}
      <span className="flex-1 text-left font-medium">{wallet.name}</span>
      {isPending && <Spinner className="size-4" />}
    </Button>
  );
}
