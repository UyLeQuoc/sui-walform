'use client';

import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount, useSuiClientContext } from '@mysten/dapp-kit';
import { listOwnedObjectIds } from './grpc/objects';
import { useSuiGrpcClient } from './grpc/use-grpc-client';
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
  const { network } = useSuiClientContext();
  const client = useSuiGrpcClient();

  const capQuery = useQuery({
    queryKey: [network, 'walform:platform-admin-caps', sender, originalPackageId],
    enabled: !!sender && !!originalPackageId,
    queryFn: ({ signal }) =>
      listOwnedObjectIds(client, {
        owner: sender!,
        type: `${originalPackageId!}::template::PlatformAdminCap`,
        signal,
      }),
  });

  const adminCapId = capQuery.data?.[0] ?? null;

  return {
    isAdmin: !!adminCapId,
    adminCapId,
    isLoading: !!sender && !!originalPackageId && capQuery.isPending,
  };
}
