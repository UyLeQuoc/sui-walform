import { Transaction } from '@mysten/sui/transactions';
import { closeForm } from '../gen/walform/form';

export interface BuildCloseFormTxInput {
  packageId: string;
  formObjectId: string;
  capObjectId: string;
}

/**
 * Sponsored `form::close_form(form, cap, clock)` PTB. After this lands, the
 * form's `closed` flag flips true and `useOnChainForms` reclassifies it from
 * Running to Ended on the next chain query.
 */
export function buildCloseFormTx(input: BuildCloseFormTxInput): Transaction {
  const tx = new Transaction();
  tx.add(
    closeForm({
      package: input.packageId,
      arguments: {
        form: input.formObjectId,
        cap: input.capObjectId,
      },
    }),
  );
  return tx;
}
