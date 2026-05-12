'use client';

import { useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';
import { useOriginalPackageId } from './package-id';

export interface UseIsPlatformAdminResult {
  /** Connected wallet holds at least one `PlatformAdminCap`. */
  isAdmin: boolean;
  /** First admin cap objectId owned by the connected wallet, or null. */
  adminCapId: string | null;
  isLoading: boolean;
}

/**
 * Detect whether the connected wallet owns a `template::PlatformAdminCap`. Used
 * both by the `/admin` panel (gates the withdraw UI) and by `<WalletDropdown>`
 * (to surface a redirect link when the connected wallet is the admin).
 *
 * Kept on the `sui/` side so `wallet-ui/` can depend on it without crossing
 * back up into `forms/`.
 */
export function useIsPlatformAdmin(): UseIsPlatformAdminResult {
  const account = useCurrentAccount();
  const sender = account?.address ?? null;
  const originalPackageId = useOriginalPackageId();

  const capQuery = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: sender ?? '',
      filter: originalPackageId
        ? { StructType: `${originalPackageId}::template::PlatformAdminCap` }
        : ({} as never),
      options: { showType: true },
    },
    { enabled: !!sender && !!originalPackageId },
  );

  const adminCapId =
    (capQuery.data?.data ?? [])
      .map((entry) => entry.data?.objectId)
      .find((id): id is string => !!id) ?? null;

  return {
    isAdmin: !!adminCapId,
    adminCapId,
    isLoading: !!sender && !!originalPackageId && capQuery.isPending,
  };
}
