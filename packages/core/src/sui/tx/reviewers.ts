import { Transaction } from '@mysten/sui/transactions';

export interface BuildInitReviewersTxInput {
  packageId: string;
  formObjectId: string;
  formOwnerCapId: string;
}

/**
 * Initialize a `FormReviewers` tracker for an existing form. Owner-gated
 * (requires `FormOwnerCap`). Useful for forms published before the
 * reviewers upgrade landed — new publish PTBs fold this in atomically.
 */
export function buildInitReviewersTx(input: BuildInitReviewersTxInput): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${input.packageId}::reviewers::create_and_share`,
    arguments: [tx.object(input.formOwnerCapId), tx.object(input.formObjectId)],
  });
  return tx;
}

export interface BuildAddReviewerTxInput {
  packageId: string;
  reviewersId: string;
  newMember: string;
}

/**
 * Add an address to a form's reviewers set. Caller must be the form owner
 * OR an existing reviewer — the Move side enforces this. Use a raw moveCall
 * (no codegen dep) so this works against pre/post-upgrade packages.
 */
export function buildAddReviewerTx(input: BuildAddReviewerTxInput): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${input.packageId}::reviewers::add_reviewer`,
    arguments: [tx.object(input.reviewersId), tx.pure.address(input.newMember)],
  });
  return tx;
}

export interface BuildRemoveReviewerTxInput {
  packageId: string;
  reviewersId: string;
  formOwnerCapId: string;
  member: string;
}

/**
 * Remove an address from the reviewers set. Owner-only — proven by the
 * FormOwnerCap, which the Move side asserts is bound to the same form.
 */
export function buildRemoveReviewerTx(input: BuildRemoveReviewerTxInput): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${input.packageId}::reviewers::remove_reviewer`,
    arguments: [
      tx.object(input.formOwnerCapId),
      tx.object(input.reviewersId),
      tx.pure.address(input.member),
    ],
  });
  return tx;
}
