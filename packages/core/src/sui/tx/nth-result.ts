import type { TransactionResult } from '@mysten/sui/transactions';

/**
 * The `index`-th value of a multi-return Move call, narrowed for
 * `noUncheckedIndexedAccess` consumers (walform-site compiles core with it on).
 */
export function nthResult(result: TransactionResult, index: number) {
  const value = result[index];
  if (!value) throw new Error(`Move call returned no value at position ${index}.`);
  return value;
}
