'use client';

import { useSuiClientContext, useSuiClientQuery } from '@mysten/dapp-kit';
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
 * this hook queries `queryEvents` on the creator's publish tx history to
 * find matching listings. React Query deduplicates so multiple cards asking
 * for the same `templateId` hit the cache.
 *
 * NOTE: this is a stop-gap for v1 — a proper indexer or a shared registry
 * object would be cheaper. Contract exposes `listing_template_id` but there's
 * no reverse index.
 */
export function useTemplateListing(templateId: string | undefined): {
  listing: TemplateListing | null;
  isLoading: boolean;
  error: Error | null;
} {
  const activePackageId = useActivePackageId();
  const { network } = useSuiClientContext();

  // MoveFunction filter matches the package used at call time. After a
  // `contracts:upgrade`, new `create_listing_and_share` txs target the
  // CURRENT packageId — not the original. Using `originalPackageId` here
  // missed every post-upgrade listing → marketplace card fell back to
  // status='free' even when the creator had set a price.
  //
  // Stop-gap: just filter by the current packageId. Listings published
  // under an earlier package version are stale and won't surface here;
  // acceptable since marketplace is post-upgrade in practice.
  const txQuery = useSuiClientQuery(
    'queryTransactionBlocks',
    {
      filter: activePackageId
        ? {
            MoveFunction: {
              package: activePackageId,
              module: 'template',
              function: 'create_listing_and_share',
            },
          }
        : ({} as never),
      options: { showObjectChanges: true, showInput: true },
      order: 'descending',
      limit: 50,
    },
    { enabled: !!activePackageId && !!templateId },
  );

  // Collect Listing object ids created in those txs. React Compiler memoizes.
  const listingIds: string[] = [];
  if (templateId) {
    const txs = txQuery.data?.data ?? [];
    for (const t of txs) {
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
  }

  const objectsQuery = useSuiClientQuery(
    'multiGetObjects',
    {
      ids: listingIds,
      options: { showContent: true, showType: true },
    },
    { enabled: listingIds.length > 0 },
  );

  const listing = resolveListing(templateId, objectsQuery.data);

  void network;
  return {
    listing,
    isLoading: txQuery.isPending || (listingIds.length > 0 && objectsQuery.isPending),
    error: (txQuery.error as Error | null) ?? (objectsQuery.error as Error | null) ?? null,
  };
}

type MultiGetObjectsData = ReturnType<typeof useSuiClientQuery<'multiGetObjects'>>['data'];

function resolveListing(
  templateId: string | undefined,
  data: MultiGetObjectsData,
): TemplateListing | null {
  if (!templateId) return null;
  const normalizedTarget = normalizeSuiAddress(templateId);
  const results = data ?? [];
  for (const entry of results) {
    const obj = entry.data;
    if (!obj?.objectId) continue;
    const content = obj.content as unknown as
      | {
          dataType: 'moveObject';
          fields: {
            template_id?: string;
            creator?: string;
            price_mist?: string | number;
          };
        }
      | undefined;
    const fields = content?.fields;
    if (!fields?.template_id) continue;
    if (normalizeSuiAddress(fields.template_id) !== normalizedTarget) continue;
    return {
      listingId: obj.objectId,
      templateId: normalizedTarget,
      creator: fields.creator ? normalizeSuiAddress(fields.creator) : '',
      priceMist: fields.price_mist ? BigInt(fields.price_mist) : 0n,
    };
  }
  return null;
}
