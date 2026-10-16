import type { ClientWithCoreApi } from '@mysten/sui/client';
import { normalizeSuiAddress } from '@mysten/sui/utils';

/**
 * The `Submission` a submit tx created, or null. `Submission` comes from the
 * original publish, so its type keeps `originalPackageId`'s prefix across
 * upgrades — including when it's created through `referral::*`.
 */
export async function extractSubmissionId(
  client: ClientWithCoreApi,
  digest: string,
  originalPackageId: string,
): Promise<string | null> {
  const res = await client.core.waitForTransaction({
    digest,
    include: { effects: true, objectTypes: true },
  });
  const tx = res.Transaction ?? res.FailedTransaction;
  const types = tx?.objectTypes ?? {};
  const pkg = normalizeSuiAddress(originalPackageId);
  const hit = (tx?.effects?.changedObjects ?? []).find((c) => {
    if (c.idOperation !== 'Created') return false;
    const [typePkg, ...rest] = (types[c.objectId] ?? '').split('::');
    return (
      !!typePkg &&
      normalizeSuiAddress(typePkg) === pkg &&
      rest.join('::') === 'submission::Submission'
    );
  });
  return hit?.objectId ?? null;
}
