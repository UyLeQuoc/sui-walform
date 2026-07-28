'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import type { SuiGrpcClient } from '@mysten/sui/grpc';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { TemplateListing as TemplateListingStruct } from '../../sui/gen/walform/template';
import { collectCreatedObjectsGql } from '../../sui/graphql/transactions';
import { getMoveObjects } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import { useActiveNetwork, type WalformNetwork } from '../../sui/env-network';
import { useActivePackageId } from '../../sui/package-id';

export interface TemplateListing {
  listingId: string;
  templateId: string;
  creator: string;
  priceMist: bigint;
}

/**
 * Look up the pay-to-clone listing bound to a given template (if any).
 * Creators publish a `TemplateListing` shared object alongside the template;
 * this hook scans the `create_listing_and_share` tx history to build a
 * `templateId → listing` map, then returns the entry for the requested
 * template.
 *
 * The scan is keyed WITHOUT `templateId`, so every marketplace card shares a
 * single React Query cache entry / single RPC scan instead of one full scan
 * per card.
 *
 * The tx scan is PAGINATED with a cursor loop — one page caps at 50 results,
 * so the previous single `limit: 50` call silently lost every listing past the
 * newest 50. A paid template that fell off page 1 then resolved to `null` and
 * `useCloneTemplateToDraft` cloned it for FREE (creator lost the sale +
 * royalty). The cursor loop fixes that.
 *
 * NOTE: still a stop-gap for v1 — a shared registry object or an indexer would
 * be cheaper than scanning tx history.
 */
export function useTemplateListing(templateId: string | undefined): {
  listing: TemplateListing | null;
  isLoading: boolean;
  error: Error | null;
} {
  const activePackageId = useActivePackageId();
  const { network } = useSuiClientContext();
  const activeNetwork = useActiveNetwork();
  const client = useSuiGrpcClient();
  const normalizedTarget = templateId ? normalizeSuiAddress(templateId) : undefined;

  const query = useQuery<Map<string, TemplateListing>>({
    // Network-prefixed (so `invalidateChain` refreshes it) and NOT keyed by
    // templateId — all cards reuse the one scan.
    queryKey: [network, 'walform:template-listings', activePackageId],
    enabled: !!activePackageId && !!normalizedTarget && !!activeNetwork,
    staleTime: 10_000,
    queryFn: () => buildListingMap(client, activeNetwork!, activePackageId!),
  });

  const listing = normalizedTarget ? (query.data?.get(normalizedTarget) ?? null) : null;

  return {
    listing,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}

async function buildListingMap(
  client: SuiGrpcClient,
  network: WalformNetwork,
  packageId: string,
): Promise<Map<string, TemplateListing>> {
  // 1) Every create_listing_and_share tx → TemplateListing object ids, newest
  //    first. After a contracts:upgrade, new listings target the CURRENT
  //    packageId, so listings published under an earlier version won't surface
  //    — acceptable since the marketplace is post-upgrade in practice.
  const listingIds = await collectCreatedObjectsGql({
    network,
    moveFunction: `${packageId}::template::create_listing_and_share`,
    createdTypeSuffix: '::template::TemplateListing',
  });

  // 2) Resolve the listing objects → map by templateId. Descending scan order
  //    means the first listing seen per template is the newest; keep it.
  const map = new Map<string, TemplateListing>();
  for (const obj of await getMoveObjects(client, TemplateListingStruct, listingIds)) {
    const tid = normalizeSuiAddress(obj.fields.template_id);
    if (map.has(tid)) continue;
    map.set(tid, {
      listingId: obj.objectId,
      templateId: tid,
      creator: normalizeSuiAddress(obj.fields.creator),
      priceMist: BigInt(obj.fields.price_mist),
    });
  }
  return map;
}
