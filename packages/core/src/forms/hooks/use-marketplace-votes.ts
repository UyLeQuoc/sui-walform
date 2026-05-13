'use client';

import { useMemo } from 'react';
import { useSuiClientQuery } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { useOriginalPackageId } from '../../sui/package-id';

export interface TemplateVoteCounts {
  votesId: string;
  templateId: string;
  upvotes: number;
  downvotes: number;
}

export interface UseMarketplaceVotesResult {
  /** Map keyed by normalized `templateId`. */
  byTemplate: Map<string, TemplateVoteCounts>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Bulk resolve `TemplateVotes` objects for every template in the marketplace.
 * Single event scan (`TemplateVotesInitialized`) → multiGetObjects on every
 * unique votes object → map by templateId. React Query dedupes across cards.
 *
 * Stop-gap pattern; same caveat as `useTemplateListing` — limit 100 events,
 * older trackers fall off. Production needs an indexer.
 */
export function useMarketplaceVotes(): UseMarketplaceVotesResult {
  const originalPackageId = useOriginalPackageId();

  const eventsQuery = useSuiClientQuery(
    'queryEvents',
    {
      query: originalPackageId
        ? {
            MoveEventType: `${originalPackageId}::voting::TemplateVotesInitialized`,
          }
        : ({} as never),
      order: 'ascending',
      limit: 100,
    },
    { enabled: !!originalPackageId },
  );

  // Keep the earliest initialization per template_id; dedup duplicates.
  const earliestByTemplate = useMemo(() => {
    const events = eventsQuery.data?.data ?? [];
    const map = new Map<string, string>();
    for (const ev of events) {
      const parsed = ev.parsedJson as { template_id?: string; votes_id?: string } | undefined;
      if (!parsed?.template_id || !parsed.votes_id) continue;
      const tid = normalizeSuiAddress(parsed.template_id);
      if (map.has(tid)) continue;
      map.set(tid, parsed.votes_id);
    }
    return map;
  }, [eventsQuery.data]);

  const votesIds = useMemo(() => [...earliestByTemplate.values()], [earliestByTemplate]);

  const objectsQuery = useSuiClientQuery(
    'multiGetObjects',
    {
      ids: votesIds,
      options: { showContent: true, showType: true },
    },
    { enabled: votesIds.length > 0 },
  );

  const byTemplate = useMemo(() => {
    const out = new Map<string, TemplateVoteCounts>();
    const objects = objectsQuery.data ?? [];
    for (const entry of objects) {
      const obj = entry.data;
      if (!obj?.objectId) continue;
      const content = obj.content as unknown as
        | {
            dataType: 'moveObject';
            fields: {
              template_id?: string;
              upvotes?: string | number;
              downvotes?: string | number;
            };
          }
        | undefined;
      const fields = content?.fields;
      if (!fields?.template_id) continue;
      const tid = normalizeSuiAddress(fields.template_id);
      out.set(tid, {
        votesId: obj.objectId,
        templateId: tid,
        upvotes: Number(fields.upvotes ?? 0),
        downvotes: Number(fields.downvotes ?? 0),
      });
    }
    return out;
  }, [objectsQuery.data]);

  const isLoading =
    (!!originalPackageId && eventsQuery.isPending) ||
    (votesIds.length > 0 && objectsQuery.isPending);
  const error = (eventsQuery.error as Error | null) ?? (objectsQuery.error as Error | null) ?? null;

  return { byTemplate, isLoading, error };
}
