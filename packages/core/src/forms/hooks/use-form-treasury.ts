'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { FormTreasury as FormTreasuryStruct } from '../../sui/gen/walform/payment';
import { collectCreatedObjectsGql } from '../../sui/graphql/transactions';
import { getMoveObjects } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import { useActiveNetwork } from '../../sui/env-network';
import { useActivePackageId } from '../../sui/package-id';

export interface FormTreasury {
  treasuryId: string;
  formId: string;
  balanceMist: bigint;
}

/**
 * Resolve the per-form `FormTreasury` by walking `payment::create_and_share`
 * txs and matching the created object's `form_id`.
 *
 * The tx scan goes through GraphQL — gRPC can only fetch a transaction by
 * digest, so "which txs called this function" has no gRPC equivalent.
 *
 * Stop-gap until we add a `TreasuryCreated` event. React Query dedupes the
 * underlying call across multiple cards: the scan is keyed WITHOUT `formId`,
 * so every card shares one pass.
 */
export function useFormTreasury(formId: string | undefined): {
  treasury: FormTreasury | null;
  isLoading: boolean;
  error: Error | null;
} {
  // The function filter matches the package used at call time — current, not
  // original. Same correction as `useTemplateListing`. Post-upgrade
  // `payment::create_and_share` txs target the active packageId.
  const activePackageId = useActivePackageId();
  const { network } = useSuiClientContext();
  const activeNetwork = useActiveNetwork();
  const client = useSuiGrpcClient();

  const query = useQuery<FormTreasury[]>({
    queryKey: [network, 'walform:form-treasuries', activePackageId],
    enabled: !!activePackageId && !!formId && !!activeNetwork,
    staleTime: 10_000,
    queryFn: async () => {
      const treasuryIds = await collectCreatedObjectsGql({
        network: activeNetwork!,
        moveFunction: `${activePackageId!}::payment::create_and_share`,
        createdTypeSuffix: '::payment::FormTreasury',
      });
      const objects = await getMoveObjects(client, FormTreasuryStruct, treasuryIds);
      return objects.map((obj) => ({
        treasuryId: obj.objectId,
        formId: normalizeSuiAddress(obj.fields.form_id),
        balanceMist: BigInt(obj.fields.balance.value),
      }));
    },
  });

  const target = formId ? normalizeSuiAddress(formId) : null;
  const treasury = target ? ((query.data ?? []).find((t) => t.formId === target) ?? null) : null;

  return {
    treasury,
    isLoading: query.isPending,
    error: (query.error as Error | null) ?? null,
  };
}
