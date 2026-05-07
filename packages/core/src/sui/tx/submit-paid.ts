import { Transaction } from '@mysten/sui/transactions';
import type { CoinStruct } from '@mysten/sui/jsonRpc';
import { submitPaidAndShare } from '../gen/walform/submission';

export interface BuildPaidSubmitTxInput {
  packageId: string;
  formObjectId: string;
  treasuryId: string;
  /** SUI coins owned by the submitter, sorted server-side by `getCoins`. */
  coins: CoinStruct[];
  feeMist: bigint;
  encryptedBody: Uint8Array;
  nonce: Uint8Array;
}

export interface BuildPaidSubmitTxResult {
  tx: Transaction;
  /** Sum of selected coins (chosen + dust merged in). Useful for error messages. */
  coverage: bigint;
}

/**
 * Builds the paid-submission PTB. The fee is split from a USER-OWNED SUI coin
 * (NOT `tx.gas` — gas belongs to the sponsor and reverts when borrowed).
 *
 * Coin selection: pick the largest coin that already covers the fee. If no
 * single coin covers it, take the first coin and merge up to 5 dust coins
 * into it before splitting the fee — covers the common "scattered dust" case
 * without making the PTB arbitrarily large.
 *
 * Throws when total holdings can't cover the fee — caller surfaces that as a
 * "need at least N SUI" toast instead of letting the chain reject.
 */
export function buildPaidSubmitTx(input: BuildPaidSubmitTxInput): BuildPaidSubmitTxResult {
  const { packageId, formObjectId, treasuryId, coins, feeMist, encryptedBody, nonce } = input;
  const total = coins.reduce((s, c) => s + BigInt(c.balance), 0n);
  if (total < feeMist) {
    throw new InsufficientSuiError(feeMist, total);
  }
  const coversWhole = coins.find((c) => BigInt(c.balance) >= feeMist);
  const chosen = coversWhole ?? coins[0];
  if (!chosen) {
    throw new InsufficientSuiError(feeMist, total);
  }
  const tx = new Transaction();
  // Merge dust into the chosen coin if it doesn't cover the fee on its own.
  // mergeCoins is a no-op when only one coin is held.
  if (BigInt(chosen.balance) < feeMist) {
    const dust = coins
      .filter((c) => c.coinObjectId !== chosen.coinObjectId)
      .map((c) => c.coinObjectId)
      .slice(0, 5);
    if (dust.length > 0) {
      tx.mergeCoins(
        tx.object(chosen.coinObjectId),
        dust.map((id) => tx.object(id)),
      );
    }
  }
  const [feeCoin] = tx.splitCoins(tx.object(chosen.coinObjectId), [tx.pure.u64(feeMist)]);
  tx.add(
    submitPaidAndShare({
      package: packageId,
      arguments: {
        form: formObjectId,
        treasury: treasuryId,
        // Codegen types feeCoin as `string` (object id) but the
        // normalizeMoveArguments runtime accepts TransactionArgument —
        // splitCoins returns one. Cast to satisfy TS.
        feeCoin: feeCoin as unknown as string,
        encryptedBody: Array.from(encryptedBody),
        fileBlobIds: [],
        nonce: Array.from(nonce),
      },
    }),
  );
  return { tx, coverage: total };
}

export class InsufficientSuiError extends Error {
  constructor(
    public readonly required: bigint,
    public readonly held: bigint,
  ) {
    super(`Insufficient SUI: need ${required.toString()} MIST, hold ${held.toString()} MIST`);
    this.name = 'InsufficientSuiError';
  }
}
