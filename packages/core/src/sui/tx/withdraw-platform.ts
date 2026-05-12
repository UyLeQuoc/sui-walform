import { Transaction } from '@mysten/sui/transactions';
import { withdrawPlatform } from '../gen/walform/template';

export interface BuildWithdrawPlatformTxInput {
  packageId: string;
  platformAdminCapId: string;
  platformTreasuryId: string;
  /** Amount in MIST to withdraw. Caller passes the full balance for "withdraw all". */
  amountMist: bigint;
  /** Address that should receive the resulting Coin<SUI>. */
  recipient: string;
}

/**
 * Splits `amountMist` out of the shared `PlatformTreasury` (10% royalty pool)
 * and transfers it to `recipient`. The contract requires the `PlatformAdminCap`
 * issued at package publish — only that cap's holder passes the gate.
 */
export function buildWithdrawPlatformTx(input: BuildWithdrawPlatformTxInput): Transaction {
  const tx = new Transaction();
  const coin = tx.add(
    withdrawPlatform({
      package: input.packageId,
      arguments: {
        Cap: input.platformAdminCapId,
        treasury: input.platformTreasuryId,
        amountMist: input.amountMist,
      },
    }),
  );
  tx.transferObjects([coin], input.recipient);
  return tx;
}
