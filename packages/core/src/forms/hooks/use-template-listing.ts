'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
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
 * The tx scan is PAGINATED with a cursor loop — `queryTransactionBlocks` caps
 * at 50 results per call, so the previous single `limit: 50` call silently lost
 * every listing past the newest 50. A paid template that fell off page 1 then
 * resolved to `null` and `useCloneTemplateToDraft` cloned it for FREE (creator
 * lost the sale + royalty). The cursor loop fixes that.
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
  const client = useSuiClient();
  const normalizedTarget = templateId ? normalizeSuiAddress(templateId) : undefined;

  const query = useQuery<Map<string, TemplateListing>>({
    // Network-prefixed (so `invalidateChain` refreshes it) and NOT keyed by
    // templateId — all cards reuse the one scan.
    queryKey: [network, 'walform:template-listings', activePackageId],
    enabled: !!activePackageId && !!normalizedTarget,
    staleTime: 10_000,
    queryFn: () => buildListingMap(client, activePackageId!),
  });

  const listing = normalizedTarget ? (query.data?.get(normalizedTarget) ?? null) : null;

  return {
    listing,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}

type SuiClient = ReturnType<typeof useSuiClient>;

async function buildListingMap(
  client: SuiClient,
  packageId: string,
): Promise<Map<string, TemplateListing>> {
  // 1) Paginate every create_listing_and_share tx → TemplateListing object ids.
  //    After a contracts:upgrade, new listings target the CURRENT packageId, so
  //    listings published under an earlier version won't surface — acceptable
  //    since the marketplace is post-upgrade in practice.
  const listingIds: string[] = [];
  let cursor: string | null | undefined = null;
  for (let page = 0; page < 100; page++) {
    const res = await client.queryTransactionBlocks({
      filter: {
        MoveFunction: { package: packageId, module: 'template', function: 'create_listing_and_share' },
      },
      options: { showObjectChanges: true },
      order: 'descending',
      limit: 50,
      cursor,
    });
    for (const t of res.data) {
      const changes = (t.objectChanges ?? []) as Array<{
        type?: string;
        objectType?: string;
        objectId?: string;
      }>;
      for (const c of changes) {
        if (
          c.type === 'created' &&
          c.objectType?.endsWith('::template::TemplateListing') &&
          c.objectId
        ) {
          listingIds.push(c.objectId);
        }
      }
    }
    if (!res.hasNextPage || !res.nextCursor) break;
    cursor = res.nextCursor;
  }

  // 2) Resolve the listing objects in batches of 50 (RPC cap) → map by
  //    templateId. Descending scan order means the first listing seen per
  //    template is the newest; keep it.
  const map = new Map<string, TemplateListing>();
  for (let i = 0; i < listingIds.length; i += 50) {
    const part = await client.multiGetObjects({
      ids: listingIds.slice(i, i + 50),
      options: { showContent: true, showType: true },
    });
    for (const entry of part) {
      const obj = entry.data;
      if (!obj?.objectId) continue;
      const content = obj.content as unknown as
        | {
            dataType: 'moveObject';
            fields: { template_id?: string; creator?: string; price_mist?: string | number };
          }
        | undefined;
      const fields = content?.fields;
      if (!fields?.template_id) continue;
      const tid = normalizeSuiAddress(fields.template_id);
      if (map.has(tid)) continue;
      map.set(tid, {
        listingId: obj.objectId,
        templateId: tid,
        creator: fields.creator ? normalizeSuiAddress(fields.creator) : '',
        priceMist: fields.price_mist ? BigInt(fields.price_mist) : 0n,
      });
    }
  }
  return map;
}
