import { Transaction } from '@mysten/sui/transactions';
import { createAndShare } from '../gen/walform/payment';

export interface BuildCreateTreasuryTxInput {
  packageId: string;
  formOwnerCapId: string;
}

/**
 * Mints + shares a `FormTreasury` bound to the form referenced by the cap.
 * Fired as a follow-up tx after `form::create_and_share` for ACCESS_PAID forms
 * (the publish PTB transfers the FormOwnerCap to the sender so it's not
 * available as a tx argument inside the same PTB).
 */
export function buildCreateTreasuryTx(input: BuildCreateTreasuryTxInput): Transaction {
  const tx = new Transaction();
  tx.add(
    createAndShare({
      package: input.packageId,
      arguments: { cap: input.formOwnerCapId },
    }),
  );
  return tx;
}
