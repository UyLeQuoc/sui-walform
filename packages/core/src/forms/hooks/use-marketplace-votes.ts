'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { TemplateVotes } from '../../sui/gen/walform/voting';
import { getMoveObjects } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import { useOriginalPackageId } from '../../sui/package-id';
import { useActiveNetwork } from '../../sui/env-network';
import { queryEventsGql, type EventsPage } from '../../sui/graphql/events';

/** Payload of `voting::TemplateVotesInitialized` (GraphQL `contents.json`). */
interface TemplateVotesInitializedEvent {
  template_id?: string;
  votes_id?: string;
}

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
  const activeNetwork = useActiveNetwork();
  const client = useSuiGrpcClient();

  const query = useQuery<Map<string, TemplateVoteCounts>>({
    queryKey: [network, 'walform:marketplace-votes', originalPackageId],
    enabled: !!originalPackageId && !!activeNetwork,
    staleTime: 10_000,
    queryFn: async () => {
      if (!originalPackageId || !activeNetwork) return new Map();

      // 1) Paginate the full TemplateVotesInitialized stream → newest tracker
      //    per template (descending scan = first-seen is newest).
      const votesByTemplate = new Map<string, string>();
      let cursor: string | null = null;
      for (let page = 0; page < 100; page++) {
        const res: EventsPage<TemplateVotesInitializedEvent> =
          await queryEventsGql<TemplateVotesInitializedEvent>({
            network: activeNetwork,
            eventType: `${originalPackageId}::voting::TemplateVotesInitialized`,
            order: 'descending',
            limit: 50,
            cursor,
          });
        for (const parsed of res.data) {
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

      // 2) Fetch + BCS-decode the TemplateVotes objects (batched internally).
      const out = new Map<string, TemplateVoteCounts>();
      for (const obj of await getMoveObjects(client, TemplateVotes, votesIds)) {
        const tid = normalizeSuiAddress(obj.fields.template_id);
        out.set(tid, {
          votesId: obj.objectId,
          templateId: tid,
          upvotes: Number(obj.fields.upvotes),
          downvotes: Number(obj.fields.downvotes),
        });
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
