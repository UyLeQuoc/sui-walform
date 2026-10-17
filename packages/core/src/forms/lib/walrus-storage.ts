/** Epochs a submission is stored for on Walrus, whoever pays for it. */
export const SUBMISSION_STORAGE_EPOCHS = 10;

const BYTES_PER_UNIT = 1_048_576n;

export interface ExtensionPlan {
  items: { sharedBlobId: string; topUpFrost: bigint }[];
  totalTopUpFrost: bigint;
  /** Blobs left out: already expired (Walrus can't revive them) or past the horizon. */
  skipped: number;
}

/**
 * What extending a form's stored blobs by `epochs` costs. Walrus charges
 * `units × storage price × epochs` (1 unit = 1 MiB encoded), drawn from each
 * SharedBlob's funds, so only the shortfall needs topping up.
 */
export function extensionPlan(
  snapshot: {
    blobs: { sharedBlobId: string; encodedSize: bigint; endEpoch: number; fundsFrost: bigint }[];
    currentEpoch: number;
    maxEpochsAhead: number;
    storagePricePerUnit: bigint;
  },
  epochs: number,
): ExtensionPlan {
  const items: ExtensionPlan['items'] = [];
  let totalTopUpFrost = 0n;
  let skipped = 0;
  for (const blob of snapshot.blobs) {
    const live = blob.endEpoch > snapshot.currentEpoch;
    const fits = blob.endEpoch + epochs - snapshot.currentEpoch <= snapshot.maxEpochsAhead;
    if (!live || !fits || epochs <= 0) {
      skipped++;
      continue;
    }
    const units = (blob.encodedSize + BYTES_PER_UNIT - 1n) / BYTES_PER_UNIT;
    const cost = units * snapshot.storagePricePerUnit * BigInt(epochs);
    const topUpFrost = cost > blob.fundsFrost ? cost - blob.fundsFrost : 0n;
    items.push({ sharedBlobId: blob.sharedBlobId, topUpFrost });
    totalTopUpFrost += topUpFrost;
  }
  return { items, totalTopUpFrost, skipped };
}

export interface ExpirySummary {
  earliestEpoch: number;
  latestEpoch: number;
  /** Already past their end epoch — Walrus can't extend these. */
  expired: number;
}

/** Earliest / latest end epoch across a form's blobs; null when there are none. */
export function expirySummary(
  blobs: { endEpoch: number }[],
  currentEpoch: number,
): ExpirySummary | null {
  if (blobs.length === 0) return null;
  const ends = blobs.map((b) => b.endEpoch);
  return {
    earliestEpoch: Math.min(...ends),
    latestEpoch: Math.max(...ends),
    expired: ends.filter((e) => e <= currentEpoch).length,
  };
}

/** Roughly how long until `endEpoch`, in whole days. */
export function daysUntilEpoch(
  endEpoch: number,
  currentEpoch: number,
  epochDurationMs: number,
): number {
  return Math.max(0, Math.round(((endEpoch - currentEpoch) * epochDurationMs) / 86_400_000));
}
