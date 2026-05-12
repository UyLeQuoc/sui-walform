'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useActivePackageId } from '../../sui/package-id';
import { buildVoteTx, type VoteIntent } from '../../sui/tx/cast-vote';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';

export interface UseVoteTemplateResult {
  cast: (intent: VoteIntent) => Promise<void>;
  isVoting: boolean;
  /** Most-recent intent being processed — useful for per-button spinner UX. */
  pending: VoteIntent | null;
}

/**
 * Action hook for casting a vote on a template. Signed + paid by the user's
 * wallet (`useExecuteTransaction`). Invalidates chain queries on success so
 * the bulk `useMarketplaceVotes` re-fetches the updated counts.
 */
export function useVoteTemplate(votesId: string | null | undefined): UseVoteTemplateResult {
  const packageId = useActivePackageId();
  const { execute, sender } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const [pending, setPending] = useState<VoteIntent | null>(null);

  const cast = async (intent: VoteIntent) => {
    if (!packageId || !votesId) {
      toast.error('Voting unavailable for this template yet.');
      return;
    }
    if (!sender) {
      toast.error('Connect a wallet to vote.');
      return;
    }
    setPending(intent);
    try {
      const tx = buildVoteTx({ packageId, votesId }, intent);
      const { digest } = await execute({ transaction: tx });
      await invalidateChain(digest);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Vote failed: ${msg}`);
    } finally {
      setPending(null);
    }
  };

  return { cast, isVoting: pending !== null, pending };
}
