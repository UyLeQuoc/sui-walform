import { Transaction } from '@mysten/sui/transactions';
import { cloneFreeAndShare } from '../gen/walform/template';
import { newSettings } from '../gen/walform/form';

export interface BuildCloneFreeTxInput {
  packageId: string;
  templateObjectId: string;
  titleForNew: string;
}

export function buildCloneFreeTx(input: BuildCloneFreeTxInput): Transaction {
  const tx = new Transaction();
  const settingsArg = tx.add(
    newSettings({
      package: input.packageId,
      arguments: {
        accessMode: 0,
        allowlistId: null,
        requiredTokenType: [],
        requiredTokenAmount: 0n,
        submissionFeeMist: 0n,
        maxSubmissions: 0n,
        closesAtMs: 0n,
      },
    }),
  );
  tx.add(
    cloneFreeAndShare({
      package: input.packageId,
      arguments: {
        template: input.templateObjectId,
        ownerSettings: settingsArg,
        titleForNew: input.titleForNew,
      },
    }),
  );
  return tx;
}

export const PLATFORM_ROYALTY_BPS = 1000n;
export const PLATFORM_MIN_ROYALTY_MIST = 50_000_000n;

/** Matches `template.move::royalty_due` — 10% with a 0.05 SUI floor. */
export function computeRoyaltyMist(priceMist: bigint): bigint {
  const pct = (priceMist * PLATFORM_ROYALTY_BPS) / 10_000n;
  return pct < PLATFORM_MIN_ROYALTY_MIST ? PLATFORM_MIN_ROYALTY_MIST : pct;
}
