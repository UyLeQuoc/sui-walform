'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import {
  useActiveNetwork,
  useSponsorConfigId,
  useSponsorTypesPackageId,
} from '../../sui/env-network';
import {
  SponsorConfig as SponsorConfigStruct,
  SponsorPool as SponsorPoolStruct,
} from '../../sui/gen/walform/sponsor_pool';
import { collectEventsGql } from '../../sui/graphql/events';
import { getMoveObject } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import type { SponsorConfigState, SponsorPoolState } from '../../types';

export type UseSponsorConfigResult =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; config: SponsorConfigState };

/** The platform `SponsorConfig`; `unavailable` when this network has none. */
export function useSponsorConfig(): UseSponsorConfigResult {
  const { network } = useSuiClientContext();
  const configId = useSponsorConfigId();
  const client = useSuiGrpcClient();
  const query = useQuery({
    queryKey: [network, 'walform:sponsor-config', configId],
    enabled: !!configId,
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<SponsorConfigState> => {
      const obj = await getMoveObject(client, SponsorConfigStruct, configId!, signal);
      if (!obj) throw new Error(`SponsorConfig ${configId} not found.`);
      return {
        configId: obj.objectId,
        feeBps: BigInt(obj.fields.fee_bps),
        maxStoragePricePerUnit: BigInt(obj.fields.max_storage_price_per_unit),
        maxWritePricePerUnit: BigInt(obj.fields.max_write_price_per_unit),
      };
    },
  });
  if (!configId) return { status: 'unavailable' };
  if (query.isPending) return { status: 'loading' };
  if (query.isError) return { status: 'error', error: query.error };
  return { status: 'success', config: query.data };
}

export type UseFormSponsorPoolResult =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; pool: SponsorPoolState | null };

interface PoolCreatedEvent {
  pool_id: string;
  form_id: string;
  config_id: string;
}

/**
 * The form's sponsorship pool, or `pool: null` if the creator hasn't opened
 * one. Discovered through `SponsorPoolCreated` events (tagged with the
 * package that introduced `sponsor_pool`, not originalPackageId); the newest
 * pool for the form under the current platform config wins.
 */
export function useFormSponsorPool(formId: string | undefined): UseFormSponsorPoolResult {
  const { network } = useSuiClientContext();
  const activeNetwork = useActiveNetwork();
  const typesPackage = useSponsorTypesPackageId();
  const configId = useSponsorConfigId();
  const client = useSuiGrpcClient();
  const available = !!typesPackage && !!configId && !!activeNetwork;

  // Keyed without formId so every form on a page shares one event scan.
  const poolIds = useQuery({
    queryKey: [network, 'walform:sponsor-pools', typesPackage, configId],
    enabled: available,
    staleTime: 10_000,
    queryFn: async () => {
      const events = await collectEventsGql<PoolCreatedEvent>({
        network: activeNetwork!,
        eventType: `${typesPackage!}::sponsor_pool::SponsorPoolCreated`,
      });
      const config = normalizeSuiAddress(configId!);
      const byForm: Record<string, string> = {};
      for (const e of events) {
        if (normalizeSuiAddress(e.config_id) === config) {
          byForm[normalizeSuiAddress(e.form_id)] = e.pool_id;
        }
      }
      return byForm;
    },
  });

  const poolId = formId ? poolIds.data?.[normalizeSuiAddress(formId)] : undefined;
  const pool = useQuery({
    queryKey: [network, 'walform:sponsor-pool', poolId],
    enabled: !!poolId,
    queryFn: async ({ signal }): Promise<SponsorPoolState | null> => {
      const obj = await getMoveObject(client, SponsorPoolStruct, poolId!, signal);
      if (!obj) return null;
      const f = obj.fields;
      return {
        poolId: obj.objectId,
        formId: normalizeSuiAddress(f.form_id),
        walFrost: BigInt(f.wal.value),
        suiMist: BigInt(f.sui.value),
        platformFeesFrost: BigInt(f.platform_fees.value),
        enabled: f.enabled,
        maxWalPerUpload: BigInt(f.max_wal_per_upload),
        maxTipPerUpload: BigInt(f.max_tip_per_upload),
        maxUploadsPerAddress: BigInt(f.max_uploads_per_address),
        totalUploads: BigInt(f.total_uploads),
        totalWalSpent: BigInt(f.total_wal_spent),
      };
    },
  });

  if (!available || !formId) return { status: 'unavailable' };
  if (poolIds.isPending) return { status: 'loading' };
  if (poolIds.isError) return { status: 'error', error: poolIds.error };
  if (!poolId) return { status: 'success', pool: null };
  if (pool.isPending) return { status: 'loading' };
  if (pool.isError) return { status: 'error', error: pool.error };
  return { status: 'success', pool: pool.data };
}
