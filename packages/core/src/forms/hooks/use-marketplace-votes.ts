'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
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
 * Paginated `TemplateVotesInitialized` scan → multiGetObjects on every unique
 * votes object → map by templateId.
 *
 * Previously this was a single `limit: 100, order: 'ascending'` query. Two bugs:
 * (1) `queryEvents` caps at 50/page so >50 trackers were dropped, and (2)
 * ascending order kept the OLDEST 100, so newly listed templates got no vote
 * tracker at all. The cursor loop (descending, full scan) resolves both — every
 * template that has a tracker now surfaces.
 *
 * Stop-gap pattern; production needs an indexer.
 */
export function useMarketplaceVotes(): UseMarketplaceVotesResult {
  const originalPackageId = useOriginalPackageId();
  const { network } = useSuiClientContext();
  const client = useSuiClient();

  const query = useQuery<Map<string, TemplateVoteCounts>>({
    queryKey: [network, 'walform:marketplace-votes', originalPackageId],
    enabled: !!originalPackageId,
    staleTime: 10_000,
    queryFn: async () => {
      if (!originalPackageId) return new Map();

      // 1) Paginate the full TemplateVotesInitialized stream → newest tracker
      //    per template (descending scan = first-seen is newest).
      const votesByTemplate = new Map<string, string>();
      let cursor: { txDigest: string; eventSeq: string } | null = null;
      for (let page = 0; page < 100; page++) {
        const res = await client.queryEvents({
          query: { MoveEventType: `${originalPackageId}::voting::TemplateVotesInitialized` },
          order: 'descending',
          limit: 50,
          cursor,
        });
        for (const ev of res.data) {
          const parsed = ev.parsedJson as { template_id?: string; votes_id?: string } | undefined;
          if (!parsed?.template_id || !parsed.votes_id) continue;
          const tid = normalizeSuiAddress(parsed.template_id);
          if (votesByTemplate.has(tid)) continue;
          votesByTemplate.set(tid, parsed.votes_id);
        }
        if (!res.hasNextPage || !res.nextCursor) break;
        cursor = res.nextCursor;
      }

      const votesIds = [...votesByTemplate.values()];
      if (votesIds.length === 0) return new Map();

      // 2) Fetch the TemplateVotes objects in batches of 50 (RPC cap).
      const out = new Map<string, TemplateVoteCounts>();
      for (let i = 0; i < votesIds.length; i += 50) {
        const part = await client.multiGetObjects({
          ids: votesIds.slice(i, i + 50),
          options: { showContent: true, showType: true },
        });
        for (const entry of part) {
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
      }
      return out;
    },
  });

  return {
    byTemplate: query.data ?? new Map(),
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}
