import { Transaction } from '@mysten/sui/transactions';
import { updateSchema } from '../gen/walform/form';

export interface BuildUpdateSchemaTxInput {
  packageId: string;
  formObjectId: string;
  formOwnerCapId: string;
  /** Raw bytes — JSON UTF-8 for plaintext, Seal ciphertext for sealed mode. */
  schemaBytes: Uint8Array;
}

/**
 * Replace the schema bytes on an existing Form. Used by the sealed-schema
 * publish flow as a follow-up tx after `form::create_and_share` so the
 * encrypted bytes can be bound to the now-known formObjectId.
 */
export function buildUpdateSchemaTx(input: BuildUpdateSchemaTxInput): Transaction {
  const tx = new Transaction();
  tx.add(
    updateSchema({
      package: input.packageId,
      arguments: {
        form: input.formObjectId,
        cap: input.formOwnerCapId,
        newSchema: Array.from(input.schemaBytes),
      },
    }),
  );
  return tx;
}
