import { Transaction } from '@mysten/sui/transactions';

export interface BuildVoteTxInput {
  packageId: string;
  /** Shared `TemplateVotes` objectId. */
  votesId: string;
}

export type VoteIntent = 'up' | 'down' | 'clear';

const FN_BY_INTENT: Record<VoteIntent, string> = {
  up: 'upvote',
  down: 'downvote',
  clear: 'clear_vote',
};

/**
 * Build a PTB that casts an up-vote, down-vote, or clears the caller's vote.
 * `voting::set_vote` toggles when intent matches the existing vote — i.e.
 * clicking the same arrow twice clears the vote.
 *
 * No codegen dependency — the voting module is new (post-2026-05-12 upgrade)
 * and we intentionally use raw `moveCall` so this file works against both
 * pre- and post-codegen states.
 */
export function buildVoteTx(input: BuildVoteTxInput, intent: VoteIntent): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${input.packageId}::voting::${FN_BY_INTENT[intent]}`,
    arguments: [tx.object(input.votesId)],
  });
  return tx;
}
