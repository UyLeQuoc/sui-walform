'use client';

import { useState } from 'react';
import { Check, Wallet } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Spinner } from '../../../ui/spinner';
import { suiToMist, walToFrost } from '../../lib/sui-amount';
import { SponsorFundingFields } from './SponsorFundingFields';

interface SponsorPoolSetupProps {
  /** Platform fee in percent, once the config has loaded. */
  feePct: number | null;
  /** WalForm's gas sponsor covers respondents' SUI gas on this network. */
  gasCovered: boolean;
  isMutating: boolean;
  onOpen: (funding: { walFrost: bigint; suiMist: bigint }) => void;
}

/** Empty state: what sponsoring does, and the first deposit. */
export function SponsorPoolSetup({
  feePct,
  gasCovered,
  isMutating,
  onOpen,
}: SponsorPoolSetupProps) {
  const [wal, setWal] = useState('1');
  const [sui, setSui] = useState('0.05');
  const funding = { walFrost: walToFrost(Number(wal)), suiMist: suiToMist(Number(sui)) };
  const benefits = [
    gasCovered
      ? "Respondents don't need WAL or SUI: your pool pays the storage, WalForm pays the gas. Each one still signs their own upload, so it's their address on Walruscan."
      : "Respondents don't need WAL. Each one still signs their own upload, so it's their address on Walruscan.",
    "Anyone can top the pool up. Only you can withdraw what's left, at any time.",
    feePct === null ? null : `WalForm adds a ${feePct}% fee on the storage it sponsors.`,
  ].filter((b): b is string => b !== null);

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-2">
        {benefits.map((text) => (
          <li key={text} className="flex gap-2 text-xs">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            <span className="text-muted-foreground">{text}</span>
          </li>
        ))}
      </ul>
      <SponsorFundingFields wal={wal} sui={sui} onWalChange={setWal} onSuiChange={setSui} />
      <div className="flex justify-end">
        <Button
          onClick={() => onOpen(funding)}
          disabled={isMutating || (funding.walFrost === 0n && funding.suiMist === 0n)}
        >
          {isMutating ? (
            <Spinner className="mr-1.5 size-4" />
          ) : (
            <Wallet className="mr-1.5 size-4" />
          )}
          Open & fund
        </Button>
      </div>
    </div>
  );
}
