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
   * `owned`    — held by an address, not listed
   * `unknown`  — owner info missing
   */
  status: 'free' | 'paid' | 'owned' | 'unknown';
  /** Listing objectId for `paid`; priceMist + creator read from on-chain listing. */
  listingId?: string;
  priceMist?: bigint;
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
 * (clone-free/paid via TemplateListing) or owned by the creator (not listed).
 *
 * NOTE: `useTemplateListing(templateId)` resolves the per-template paid
 * listing on-demand from the MarketplaceCard so a free template that later
 * acquired a listing surfaces correctly without a second pass here.
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
      let ownerAddress: string | undefined;
      if (owner && typeof owner === 'object') {
        if ('Shared' in owner) {
          // Default to `free` — MarketplaceCard runs useTemplateListing and
          // upgrades the row to `paid` when it finds a matching listing.
          status = 'free';
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
        ownerAddress,
      });
    }
    out.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return out;
  }, [eventsQuery.data, objectsQuery.data]);

  const isLoading =
    (!!originalPackageId && eventsQuery.isPending) ||
    (templateIds.length > 0 && objectsQuery.isPending);
  const error =
    (eventsQuery.error as Error | null) ?? (objectsQuery.error as Error | null) ?? null;

  void network;
  return { templates, isLoading, error, packageMissing };
}
