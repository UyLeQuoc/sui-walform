'use client';

import { Coins } from 'lucide-react';
import { Button } from '../../../ui/button';
import { useTreasuryActions } from '../../hooks/use-treasury-actions';
import { formatSui } from '../../lib/sui-amount';
import type { OnChainForm } from '../../hooks/use-on-chain-forms';

interface WithdrawTreasuryButtonProps {
  form: OnChainForm;
}

/**
 * Surfaces both the happy-path withdraw action AND a recovery button for
 * paid forms whose publish-time treasury creation failed (no treasury
 * resolved → can't `submit_paid` until one exists).
 */
export function WithdrawTreasuryButton({ form }: WithdrawTreasuryButtonProps) {
  const {
    treasury,
    isResolvingTreasury,
    isWithdrawing,
    isCreatingTreasury,
    withdraw,
    createTreasury,
  } = useTreasuryActions({ formId: form.formId, capId: form.capId });

  if (isResolvingTreasury) {
    return (
      <div className="border-t pt-3">
        <Button variant="outline" disabled>
          <Coins className="mr-1.5 h-3.5 w-3.5" />
          Resolving treasury…
        </Button>
      </div>
    );
  }

  if (!treasury) {
    return (
      <div className="border-t pt-3">
        <Button
          variant="outline"
          disabled={isCreatingTreasury}
          onClick={() => void createTreasury()}
          title="Create the FormTreasury that submit_paid needs (recovers from a failed publish-time creation)"
        >
          <Coins className="mr-1.5 h-3.5 w-3.5" />
          {isCreatingTreasury ? 'Creating treasury…' : 'Create treasury'}
        </Button>
      </div>
    );
  }

  const empty = treasury.balanceMist === 0n;
  return (
    <div className="border-t pt-3">
      <Button
        variant="outline"
        disabled={empty || isWithdrawing}
        onClick={() => void withdraw()}
        title={empty ? 'Treasury is empty' : 'Withdraw the entire treasury balance to your wallet'}
      >
        <Coins className="mr-1.5 h-3.5 w-3.5" />
        {isWithdrawing
          ? 'Withdrawing…'
          : empty
            ? 'Treasury empty'
            : `Withdraw · ${formatSui(treasury.balanceMist)} SUI`}
      </Button>
    </div>
  );
}
