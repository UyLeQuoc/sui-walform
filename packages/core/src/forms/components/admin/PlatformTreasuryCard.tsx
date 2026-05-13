'use client';

import { useState } from 'react';
import { Coins, Lock, ShieldAlert, Wallet } from 'lucide-react';
import { useCurrentWallet, useSuiClientContext } from '@mysten/dapp-kit';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { suivisionUrl, type ExplorerNetwork } from '../../../sui/explorer';
import { WalletConnectModal } from '../../../sui/wallet-ui/WalletConnectModal';
import { usePlatformTreasury } from '../../hooks/use-platform-treasury';
import { formatSui, suiToMist } from '../../lib/sui-amount';
import { shortAddr } from '../../lib/format-address';

export function PlatformTreasuryCard() {
  const { network } = useSuiClientContext();
  const explorer = (
    network === 'mainnet' || network === 'devnet' ? network : 'testnet'
  ) as ExplorerNetwork;
  const { isConnected } = useCurrentWallet();
  const treasury = usePlatformTreasury();
  const [connectOpen, setConnectOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');

  if (!isConnected) {
    return (
      <>
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4" />
              Connect a wallet to access the platform admin panel.
            </div>
            <Button onClick={() => setConnectOpen(true)}>
              <Wallet className="mr-1.5 h-4 w-4" />
              Connect wallet
            </Button>
          </CardContent>
        </Card>
        <WalletConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
      </>
    );
  }

  if (treasury.isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="bg-muted h-24 animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (!treasury.treasuryId) {
    return (
      <Card>
        <CardContent className="p-6 text-sm">
          <p className="font-medium">Treasury not configured.</p>
          <p className="text-muted-foreground mt-1">
            Set <code className="font-mono">NEXT_PUBLIC_PLATFORM_TREASURY_ID</code> in{' '}
            <code className="font-mono">apps/builder/.env.local</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!treasury.isAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-6 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="text-destructive h-4 w-4" />
            Not authorized.
          </div>
          <p className="text-muted-foreground">
            The connected wallet does not hold a <code className="font-mono">PlatformAdminCap</code>
            . Withdrawals can only be signed by the address that owns the cap.
          </p>
          <p className="text-muted-foreground text-xs">
            Connected as{' '}
            <span className="font-mono">{treasury.sender ? shortAddr(treasury.sender) : '—'}</span>.
          </p>
        </CardContent>
      </Card>
    );
  }

  const parsedAmountSui = Number.parseFloat(amount);
  const amountMist =
    Number.isFinite(parsedAmountSui) && parsedAmountSui > 0 ? suiToMist(parsedAmountSui) : 0n;
  const empty = treasury.balanceMist === 0n;
  const overdraw = amountMist > treasury.balanceMist;
  const canWithdraw = !treasury.isWithdrawing && !empty && amountMist > 0n && !overdraw;

  const handleWithdraw = async () => {
    if (!canWithdraw) return;
    const trimmedRecipient = recipient.trim();
    await treasury.withdraw(amountMist, trimmedRecipient || undefined);
    setAmount('');
  };

  const handleWithdrawAll = async () => {
    if (treasury.isWithdrawing || empty) return;
    const trimmedRecipient = recipient.trim();
    await treasury.withdrawAll(trimmedRecipient || undefined);
    setAmount('');
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-muted-foreground text-xs">Royalty pool balance</div>
            <div className="mt-1 flex items-baseline gap-1.5 text-2xl font-semibold">
              <Coins className="h-5 w-5" />
              {formatSui(treasury.balanceMist)}
              <span className="text-muted-foreground text-base font-normal">SUI</span>
            </div>
          </div>
          <a
            href={suivisionUrl(explorer, 'object', treasury.treasuryId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
            title={treasury.treasuryId}
          >
            <span className="font-mono">{shortAddr(treasury.treasuryId)}</span> ↗
          </a>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-withdraw-amount">Amount (SUI)</Label>
            <Input
              id="admin-withdraw-amount"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={treasury.isWithdrawing || empty}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => setAmount(formatSui(treasury.balanceMist))}
              disabled={empty || treasury.isWithdrawing}
            >
              Max
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-withdraw-recipient">Recipient</Label>
          <Input
            id="admin-withdraw-recipient"
            placeholder={treasury.sender ?? '0x…'}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={treasury.isWithdrawing}
          />
          <p className="text-muted-foreground text-xs">
            Leave blank to send to your connected wallet.
          </p>
        </div>

        {overdraw && (
          <p className="text-destructive text-xs">
            Amount exceeds treasury balance ({formatSui(treasury.balanceMist)} SUI).
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleWithdraw} disabled={!canWithdraw}>
            <Coins className="mr-1.5 h-4 w-4" />
            {treasury.isWithdrawing ? 'Withdrawing…' : 'Withdraw'}
          </Button>
          <Button
            variant="outline"
            onClick={handleWithdrawAll}
            disabled={empty || treasury.isWithdrawing}
            title={empty ? 'Treasury is empty' : 'Withdraw the full balance'}
          >
            {empty
              ? 'Treasury empty'
              : treasury.isWithdrawing
                ? 'Withdrawing…'
                : `Withdraw all · ${formatSui(treasury.balanceMist)} SUI`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
