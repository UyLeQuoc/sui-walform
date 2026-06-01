import { Transaction } from '@mysten/sui/transactions';

export interface BuildAddAllowlistMembersTxInput {
  packageId: string;
  allowlistId: string;
  formOwnerCapId: string;
  members: string[];
}

/**
 * Add one or more addresses to a form's submit Allowlist after publish.
 * Owner-only — the Move side (`allowlist::add_many`) asserts the FormOwnerCap
 * is bound to the same form. Already-present members are skipped on-chain (no
 * error), so this is safe to re-run. Raw moveCall (no codegen dep) so it works
 * against pre/post-upgrade packages.
 */
export function buildAddAllowlistMembersTx(input: BuildAddAllowlistMembersTxInput): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${input.packageId}::allowlist::add_many`,
    arguments: [
      tx.object(input.allowlistId),
      tx.object(input.formOwnerCapId),
      tx.pure.vector('address', input.members),
    ],
  });
  return tx;
}

export interface BuildRemoveAllowlistMemberTxInput {
  packageId: string;
  allowlistId: string;
  formOwnerCapId: string;
  member: string;
}

/** Remove an address from a form's submit Allowlist. Owner-only. */
export function buildRemoveAllowlistMemberTx(input: BuildRemoveAllowlistMemberTxInput): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${input.packageId}::allowlist::remove`,
    arguments: [
      tx.object(input.allowlistId),
      tx.object(input.formOwnerCapId),
      tx.pure.address(input.member),
    ],
  });
  return tx;
}
