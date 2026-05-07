import { Transaction } from '@mysten/sui/transactions';
import { withdrawAll } from '../gen/walform/payment';

export interface BuildWithdrawAllTxInput {
  packageId: string;
  treasuryObjectId: string;
  formOwnerCapId: string;
  /** Address that should receive the withdrawn Coin<SUI>. Usually the sender. */
  recipient: string;
}

/**
 * Pulls the entire SUI balance out of a `FormTreasury` and transfers the
 * resulting Coin to `recipient`. The contract requires the FormOwnerCap whose
 * `form_id` matches the treasury — only the form's creator passes this check.
 */
export function buildWithdrawAllTx(input: BuildWithdrawAllTxInput): Transaction {
  const tx = new Transaction();
  const coin = tx.add(
    withdrawAll({
      package: input.packageId,
      arguments: {
        treasury: input.treasuryObjectId,
        cap: input.formOwnerCapId,
      },
    }),
  );
  tx.transferObjects([coin], input.recipient);
  return tx;
}
