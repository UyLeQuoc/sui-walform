'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { FormTemplate } from '../../sui/gen/walform/template';
import { getMoveObjects } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import { useOriginalPackageId } from '../../sui/package-id';
import { useActiveNetwork } from '../../sui/env-network';
import { queryEventsGql, type EventsPage } from '../../sui/graphql/events';

/** Payload of `events::TemplatePublished` (GraphQL `contents.json`). */
interface TemplatePublishedEvent {
  template_id?: string;
  creator?: string;
  title?: string;
  category?: number | string;
  created_at_ms?: number | string;
}

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
 * surfaced via the `TemplatePublished` event stream. For each event the hook
 * follows the template objectId to determine whether it's shared
 * (clone-free/paid via TemplateListing) or owned by the creator (not listed).
 *
 * The event scan is PAGINATED with a cursor loop — `queryEvents` caps at 50 per
 * call, so the previous single `limit: 100` query only ever surfaced the newest
 * ~50 templates and silently hid the rest of the marketplace.
 *
 * NOTE: `useTemplateListing(templateId)` resolves the per-template paid listing
 * on-demand from the MarketplaceCard so a free template that later acquired a
 * listing surfaces correctly without a second pass here.
 */
export function useMarketplaceTemplates(): UseMarketplaceTemplatesResult {
  const originalPackageId = useOriginalPackageId();
  const { network } = useSuiClientContext();
  const client = useSuiGrpcClient();
  const activeNetwork = useActiveNetwork();
  const packageMissing = !originalPackageId;

  const query = useQuery<MarketplaceTemplate[]>({
    queryKey: [network, 'walform:marketplace-templates', originalPackageId],
    enabled: !!originalPackageId && !!activeNetwork,
    staleTime: 10_000,
    queryFn: async () => {
      if (!originalPackageId || !activeNetwork) return [];

      // 1) Paginate the full TemplatePublished stream → ordered, de-duped ids
      //    + per-template event metadata.
      const eventByTemplateId = new Map<
        string,
        { creator: string; title: string; category: number; createdAtMs: number }
      >();
      const orderedIds: string[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 100; page++) {
        const res: EventsPage<TemplatePublishedEvent> = await queryEventsGql<TemplatePublishedEvent>({
          network: activeNetwork,
          eventType: `${originalPackageId}::events::TemplatePublished`,
          order: 'descending',
          limit: 50,
          cursor,
        });
        for (const parsed of res.data) {
          if (!parsed?.template_id || eventByTemplateId.has(parsed.template_id)) continue;
          eventByTemplateId.set(parsed.template_id, {
            creator: parsed.creator ? normalizeSuiAddress(parsed.creator) : '',
            title: parsed.title ?? 'Untitled',
            category: Number(parsed.category ?? 0),
            createdAtMs: Number(parsed.created_at_ms ?? 0),
          });
          orderedIds.push(parsed.template_id);
        }
        if (!res.hasNextPage || !res.nextCursor) break;
        cursor = res.nextCursor;
      }

      if (orderedIds.length === 0) return [];

      // 2) Fetch + BCS-decode the FormTemplate objects (batched internally).
      const out: MarketplaceTemplate[] = [];
      for (const obj of await getMoveObjects(client, FormTemplate, orderedIds)) {
        const meta = eventByTemplateId.get(obj.objectId);
        const f = obj.fields;

        let status: MarketplaceTemplate['status'] = 'unknown';
        let ownerAddress: string | undefined;
        if (obj.owner.$kind === 'Shared' || obj.owner.$kind === 'ConsensusAddressOwner') {
          // Default to `free` — MarketplaceCard runs useTemplateListing and
          // upgrades the row to `paid` when it finds a matching listing.
          status = 'free';
        } else if (obj.owner.$kind === 'AddressOwner') {
          status = 'owned';
          ownerAddress = normalizeSuiAddress(obj.owner.AddressOwner);
        }

        out.push({
          templateId: obj.objectId,
          creator: meta?.creator ?? normalizeSuiAddress(f.creator),
          title: f.title || (meta?.title ?? 'Untitled'),
          description: f.description,
          category: Number(f.category),
          cloneCount: Number(f.clone_count),
          tags: f.tags,
          createdAtMs: meta?.createdAtMs ?? 0,
          status,
          ownerAddress,
        });
      }
      out.sort((a, b) => b.createdAtMs - a.createdAtMs);
      return out;
    },
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    packageMissing,
  };
}
