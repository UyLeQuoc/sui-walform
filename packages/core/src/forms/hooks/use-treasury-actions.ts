'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useActivePackageId } from '../../sui/package-id';
import { buildCreateTreasuryTx } from '../../sui/tx/create-treasury';
import { buildWithdrawAllTx } from '../../sui/tx/withdraw-treasury';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';
import { formatSui } from '../lib/sui-amount';
import { useFormTreasury } from './use-form-treasury';

export interface UseTreasuryActionsInput {
  formId: string;
  capId: string;
}

export interface UseTreasuryActionsResult {
  treasury: ReturnType<typeof useFormTreasury>['treasury'];
  isResolvingTreasury: boolean;
  isWithdrawing: boolean;
  isCreatingTreasury: boolean;
  /** Withdraws every MIST from the treasury to the connected wallet. */
  withdraw: () => Promise<void>;
  /** Recovery path: re-fires the publish-time `payment::create_and_share` tx. */
  createTreasury: () => Promise<void>;
}

/**
 * Owns the paid-form treasury actions surfaced on the My Forms list:
 * `withdraw_all` for collecting fees, and `create_and_share` as a recovery
 * path when the publish-time treasury creation step failed (the form is
 * publishable but `submit_paid` reverts until the treasury exists).
 */
export function useTreasuryActions(input: UseTreasuryActionsInput): UseTreasuryActionsResult {
  const { formId, capId } = input;
  const packageId = useActivePackageId();
  const { execute, sender } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const { treasury, isLoading } = useFormTreasury(formId);

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isCreatingTreasury, setIsCreatingTreasury] = useState(false);

  const withdraw = async () => {
    if (!sender || !packageId || !treasury) return;
    setIsWithdrawing(true);
    try {
      const tx = buildWithdrawAllTx({
        packageId,
        treasuryObjectId: treasury.treasuryId,
        formOwnerCapId: capId,
        recipient: sender,
      });
      const { digest } = await execute({ transaction: tx });
      await invalidateChain(digest);
      toast.success(`Withdrew ${formatSui(treasury.balanceMist)} SUI to your wallet.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Withdraw failed: ${msg}`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const createTreasury = async () => {
    if (!sender || !packageId) return;
    setIsCreatingTreasury(true);
    try {
      const tx = buildCreateTreasuryTx({ packageId, formOwnerCapId: capId });
      const { digest } = await execute({ transaction: tx });
      await invalidateChain(digest);
      toast.success('Treasury created — submissions will work now.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Treasury creation failed: ${msg}`);
    } finally {
      setIsCreatingTreasury(false);
    }
  };

  return {
    treasury,
    isResolvingTreasury: isLoading,
    isWithdrawing,
    isCreatingTreasury,
    withdraw,
    createTreasury,
  };
}
