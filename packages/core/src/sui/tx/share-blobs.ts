import type { Transaction } from '@mysten/sui/transactions';

/**
 * Wraps each certified Blob the sender owns in a `walrus::shared_blob::SharedBlob`.
 * Once shared, anyone can `fund` and `extend` it, so a form's creator can keep
 * respondents' submissions alive without them. Appended to the submit tx, so it
 * costs no extra signature.
 */
export function addShareBlobs(
  tx: Transaction,
  input: {
    /** Current Walrus package (Walrus System object's `package_id`). */
    walrusPackageId: string;
    blobObjectIds: string[];
  },
): void {
  for (const id of input.blobObjectIds) {
    tx.moveCall({
      target: `${input.walrusPackageId}::shared_blob::new`,
      arguments: [tx.object(id)],
    });
  }
}
