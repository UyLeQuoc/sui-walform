import { coinWithBalance, Transaction } from '@mysten/sui/transactions';

export interface ExtendSharedBlobItem {
  sharedBlobId: string;
  /** WAL to add before extending — the shortfall between the cost and its existing funds. */
  topUpFrost: bigint;
}

/**
 * Tops up and extends each `walrus::shared_blob::SharedBlob` by `epochs`.
 * `extend` pays from the SharedBlob's own funds, so anyone — creator, a
 * co-sponsor — can keep a form's submissions alive.
 */
export function buildExtendSharedBlobsTx(input: {
  /** Current Walrus package (Walrus System object's `package_id`). */
  walrusPackageId: string;
  systemObjectId: string;
  walCoinType: string;
  epochs: number;
  items: ExtendSharedBlobItem[];
}): Transaction {
  const tx = new Transaction();
  for (const item of input.items) {
    if (item.topUpFrost > 0n) {
      tx.moveCall({
        target: `${input.walrusPackageId}::shared_blob::fund`,
        arguments: [
          tx.object(item.sharedBlobId),
          coinWithBalance({ type: input.walCoinType, balance: item.topUpFrost }),
        ],
      });
    }
    tx.moveCall({
      target: `${input.walrusPackageId}::shared_blob::extend`,
      arguments: [
        tx.object(item.sharedBlobId),
        tx.object(input.systemObjectId),
        tx.pure.u32(input.epochs),
      ],
    });
  }
  return tx;
}
