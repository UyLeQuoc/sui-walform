'use client';

import { useState } from 'react';
import { ArrowBigDown, ArrowBigUp } from 'lucide-react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { cn } from '../../../lib/utils';
import { Button } from '../../../ui/button';
import { Spinner } from '../../../ui/spinner';
import { WalletConnectModal } from '../../../sui/wallet-ui/WalletConnectModal';
import { useVoteTemplate } from '../../hooks/use-vote-template';
import type { TemplateVoteCounts } from '../../hooks/use-marketplace-votes';

interface VoteButtonsProps {
  /** Null if this template doesn't have a TemplateVotes tracker yet (legacy). */
  votes: TemplateVoteCounts | null | undefined;
  /** 'sm' for marketplace cards, 'md' for the preview dialog header. */
  size?: 'sm' | 'md';
}

/**
 * Compact up/down arrow pair with running counts. Toggle behavior: clicking
 * the active arrow clears the vote; clicking the other arrow switches sides.
 * Falls back to a disabled "—" pair when the template has no tracker yet.
 */
export function VoteButtons({ votes, size = 'sm' }: VoteButtonsProps) {
  const { isConnected } = useCurrentWallet();
  const { cast, pending } = useVoteTemplate(votes?.votesId);
  const [connectOpen, setConnectOpen] = useState(false);

  const handle = (intent: 'up' | 'down') => {
    if (!isConnected) {
      setConnectOpen(true);
      return;
    }
    void cast(intent);
  };

  const disabled = !votes;
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const padding = size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5';
  const textCls = size === 'sm' ? 'text-xs' : 'text-sm';
  const tooltip = disabled
    ? 'Voting tracker not initialized for this template yet.'
    : 'Toggle your vote';

  return (
    <>
      <div className="inline-flex items-center gap-0.5" title={tooltip}>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-auto gap-1', padding, textCls)}
          disabled={disabled || pending === 'up'}
          onClick={() => handle('up')}
        >
          {pending === 'up' ? (
            <Spinner className="size-3.5" />
          ) : (
            <ArrowBigUp className={iconSize} />
          )}
          <span className="tabular-nums">{votes?.upvotes ?? 0}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-auto gap-1', padding, textCls)}
          disabled={disabled || pending === 'down'}
          onClick={() => handle('down')}
        >
          {pending === 'down' ? (
            <Spinner className="size-3.5" />
          ) : (
            <ArrowBigDown className={iconSize} />
          )}
          <span className="tabular-nums">{votes?.downvotes ?? 0}</span>
        </Button>
      </div>
      <WalletConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
    </>
  );
}
