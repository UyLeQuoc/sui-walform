'use client';

import { useMemo } from 'react';
import { useSuiClientContext, useSuiClientQuery } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { useOriginalPackageId } from '../../sui/package-id';

export interface MarketplaceTemplate {
  templateId: string;
  creator: string;
  title: string;
  description: string;
  category: number;
  cloneCount: number;
  tags: string[];
  createdAtMs: number;
  /**
   * `free`     — shared template, clone via `clone_free_and_share` (price 0, N clones)
   * `paid`     — shared template with a TemplateListing, clone via `clone_paid_and_share`
   * `kiosk`    — legacy 1-of-1 Kiosk listing (single buyer consumes template)
   * `owned`    — held by an address, not listed
   * `unknown`  — owner info missing
   */
  status: 'free' | 'paid' | 'kiosk' | 'owned' | 'unknown';
  /** Listing objectId for `paid`; priceMist + creator read from on-chain listing. */
  listingId?: string;
  priceMist?: bigint;
  /** Kiosk object id for legacy kiosk-listed templates. */
  kioskId?: string;
  /** Address of the owning wallet when status='owned'. */
  ownerAddress?: string;
}

export interface UseMarketplaceTemplatesResult {
  templates: MarketplaceTemplate[];
  isLoading: boolean;
  error: Error | null;
  packageMissing: boolean;
}

/**
 * Public marketplace: every FormTemplate that's been published on-chain,
 * surfaced via the `TemplatePublished` event stream. For each event the
 * hook follows the template objectId to determine whether it's shared
 * (clone-free), in a Kiosk (for sale), or owned by the creator (not listed).
 *
 * NOTE: the Kiosk price is NOT fetched here — call `useKioskListingPrice`
 * on-demand when the user clicks Buy so we don't flood RPC with dynamic-field
 * reads for templates that may never be purchased.
 */
export function useMarketplaceTemplates(): UseMarketplaceTemplatesResult {
  const originalPackageId = useOriginalPackageId();
  const { network } = useSuiClientContext();
  const packageMissing = !originalPackageId;

  const eventsQuery = useSuiClientQuery(
    'queryEvents',
    {
      query: originalPackageId
        ? {
            MoveEventType: `${originalPackageId}::events::TemplatePublished`,
          }
        : ({} as never),
      order: 'descending',
      limit: 100,
    },
    { enabled: !!originalPackageId },
  );

  const templateIds = useMemo(() => {
    const events = eventsQuery.data?.data ?? [];
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const ev of events) {
      const parsed = ev.parsedJson as { template_id?: string } | undefined;
      const id = parsed?.template_id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }, [eventsQuery.data]);

  const objectsQuery = useSuiClientQuery(
    'multiGetObjects',
    {
      ids: templateIds,
      options: { showContent: true, showType: true, showOwner: true },
    },
    { enabled: templateIds.length > 0 },
  );

  // Kiosk listings store items via dynamic_object_field. The template's direct
  // owner is that wrapper (type `0x2::dynamic_field::Field<...>`), and the
  // wrapper's owner is the real Kiosk id. Walk up one level for every
  // template with an ObjectOwner so the Buy flow can hit the correct parent.
  const wrapperIds = useMemo(() => {
    const objects = objectsQuery.data ?? [];
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const entry of objects) {
      const owner = entry.data?.owner as { ObjectOwner?: string } | undefined;
      const wrapperId = owner?.ObjectOwner;
      if (!wrapperId || seen.has(wrapperId)) continue;
      seen.add(wrapperId);
      ids.push(wrapperId);
    }
    return ids;
  }, [objectsQuery.data]);

  const wrappersQuery = useSuiClientQuery(
    'multiGetObjects',
    { ids: wrapperIds, options: { showOwner: true } },
    { enabled: wrapperIds.length > 0 },
  );

  const wrapperToKiosk = useMemo(() => {
    const map = new Map<string, string>();
    const wrappers = wrappersQuery.data ?? [];
    for (const entry of wrappers) {
      const wrapperId = entry.data?.objectId;
      const parentOwner = entry.data?.owner as { ObjectOwner?: string } | undefined;
      if (wrapperId && parentOwner?.ObjectOwner) {
        map.set(wrapperId, parentOwner.ObjectOwner);
      }
    }
    return map;
  }, [wrappersQuery.data]);

  // Query TemplateListing shared objects — for the multi-buyer paid path.
  // We filter by struct type; Sui returns every shared object of that type.
  const listingsQuery = useSuiClientQuery(
    'queryEvents',
    {
      query: originalPackageId
        ? {
            MoveEventType: `0x2::dynamic_field::Field`,
          }
        : ({} as never),
      // We actually don't want dynamic_field events — fall back to direct
      // object lookup. Use a placeholder disabled query instead.
      limit: 1,
    },
    { enabled: false },
  );
  void listingsQuery;

  // Listings are owned by the template creator (created by them) so we can't
  // query by owner without knowing every creator. Instead we read the listing
  // object id from a separate RPC call for each paid-kind template. Cheaper:
  // query dynamic fields on the global "walform marketplace" registry — but
  // we don't have one. For MVP: skip listing discovery here; the Marketplace
  // UI uses `useTemplateListing(templateId)` to resolve price on-demand per
  // card (parallel queries, React Query deduplicates).

  const templates = useMemo<MarketplaceTemplate[]>(() => {
    const events = eventsQuery.data?.data ?? [];
    const eventByTemplateId = new Map<
      string,
      { creator: string; title: string; category: number; createdAtMs: number }
    >();
    for (const ev of events) {
      const parsed = ev.parsedJson as
        | {
            template_id?: string;
            creator?: string;
            title?: string;
            category?: number | string;
            created_at_ms?: number | string;
          }
        | undefined;
      if (!parsed?.template_id) continue;
      if (eventByTemplateId.has(parsed.template_id)) continue;
      eventByTemplateId.set(parsed.template_id, {
        creator: parsed.creator ? normalizeSuiAddress(parsed.creator) : '',
        title: parsed.title ?? 'Untitled',
        category: Number(parsed.category ?? 0),
        createdAtMs: Number(parsed.created_at_ms ?? 0),
      });
    }

    const objects = objectsQuery.data ?? [];
    const out: MarketplaceTemplate[] = [];
    for (const entry of objects) {
      const obj = entry.data;
      if (!obj?.objectId) continue;
      const meta = eventByTemplateId.get(obj.objectId);
      const content = obj.content as unknown as
        | {
            dataType: 'moveObject';
            fields: {
              title?: string;
              description?: string;
              category?: number | string;
              clone_count?: number | string;
              creator?: string;
              tags?: string[];
            };
          }
        | undefined;
      const fields = content?.fields;
      const owner = obj.owner as
        | 'Immutable'
        | { Shared: { initial_shared_version: string } }
        | { AddressOwner: string }
        | { ObjectOwner: string }
        | undefined;

      let status: MarketplaceTemplate['status'] = 'unknown';
      let kioskId: string | undefined;
      let ownerAddress: string | undefined;
      if (owner && typeof owner === 'object') {
        if ('Shared' in owner) {
          // Default to `free` — the Marketplace card runs useTemplateListing
          // and upgrades the row to `paid` when it finds a matching listing.
          status = 'free';
        } else if ('ObjectOwner' in owner) {
          status = 'kiosk';
          // Resolve wrapper → actual Kiosk; fall back to the wrapper id if the
          // second-hop lookup is still in flight.
          kioskId = wrapperToKiosk.get(owner.ObjectOwner) ?? owner.ObjectOwner;
        } else if ('AddressOwner' in owner) {
          status = 'owned';
          ownerAddress = owner.AddressOwner;
        }
      }

      out.push({
        templateId: obj.objectId,
        creator: meta?.creator ?? (fields?.creator ? normalizeSuiAddress(fields.creator) : ''),
        title: fields?.title ?? meta?.title ?? 'Untitled',
        description: fields?.description ?? '',
        category: Number(fields?.category ?? meta?.category ?? 0),
        cloneCount: Number(fields?.clone_count ?? 0),
        tags: fields?.tags ?? [],
        createdAtMs: meta?.createdAtMs ?? 0,
        status,
        kioskId,
        ownerAddress,
      });
    }
    out.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return out;
  }, [eventsQuery.data, objectsQuery.data, wrapperToKiosk]);

  const isLoading =
    (!!originalPackageId && eventsQuery.isPending) ||
    (templateIds.length > 0 && objectsQuery.isPending) ||
    (wrapperIds.length > 0 && wrappersQuery.isPending);
  const error =
    (eventsQuery.error as Error | null) ??
    (objectsQuery.error as Error | null) ??
    (wrappersQuery.error as Error | null) ??
    null;

  void network;
  return { templates, isLoading, error, packageMissing };
}
