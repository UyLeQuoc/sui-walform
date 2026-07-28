/**
 * GraphQL replacement for JSON-RPC `client.queryTransactionBlocks`.
 *
 * Like events, this cannot go to gRPC: the gRPC surface only fetches a
 * transaction by digest (`LedgerService.GetTransaction`), so there's no way to
 * ask "which transactions called this Move function". Two features need exactly
 * that — the marketplace's `TemplateListing` lookup and the paid-form
 * `FormTreasury` lookup — because neither object emits a discovery event.
 *
 * Same endpoint caveat as events (see `./client.ts`): the indexer must carry
 * full history, or listings and treasuries older than its retention window
 * vanish, which reads as "my paid template went free".
 */

import type { WalformNetwork } from '../env-network';
import { suiGraphqlRequest } from './client';

interface TransactionsQueryResponse {
  transactions: {
    pageInfo: {
      hasPreviousPage: boolean;
      startCursor: string | null;
    };
    nodes: {
      effects: {
        objectChanges: {
          nodes: {
            address: string;
            idCreated: boolean | null;
            outputState: {
              asMoveObject: { contents: { type: { repr: string } } | null } | null;
            } | null;
          }[];
        };
      } | null;
    }[];
  };
}

// Backward pagination (`last`/`before`) = newest-first, matching what
// `queryTransactionBlocks({ order: 'descending' })` gave the call sites. There
// is no `order` argument in this schema.
const QUERY = `query WalformTxByFunction($function: String!, $last: Int!, $before: String, $changes: Int!) {
  transactions(filter: { function: $function }, last: $last, before: $before) {
    pageInfo { hasPreviousPage startCursor }
    nodes {
      effects {
        objectChanges(last: $changes) {
          nodes {
            address
            idCreated
            outputState { asMoveObject { contents { type { repr } } } }
          }
        }
      }
    }
  }
}`;

/**
 * Ids of every object created by a transaction calling `moveFunction`, whose
 * type ends with `createdTypeSuffix`. Newest transaction first.
 *
 * `moveFunction` is fully qualified (`pkg::module::function`) and matches on
 * the CURRENT package id — a listing created before a `contracts:upgrade` is
 * filed under the older id and won't surface here, same as the JSON-RPC
 * behaviour this replaces.
 *
 * `maxPages` is a runaway guard, not a product limit.
 */
export async function collectCreatedObjectsGql(opts: {
  network: WalformNetwork;
  moveFunction: string;
  /** e.g. `::template::TemplateListing`. */
  createdTypeSuffix: string;
  pageSize?: number;
  maxPages?: number;
}): Promise<string[]> {
  const { network, moveFunction, createdTypeSuffix, pageSize = 50, maxPages = 100 } = opts;
  const out: string[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const res: TransactionsQueryResponse = await suiGraphqlRequest<TransactionsQueryResponse>(
      network,
      QUERY,
      {
        function: moveFunction,
        last: pageSize,
        before: cursor,
        // One PTB can create a handful of objects (a publish-and-list tx creates
        // Form, cap, reviewers, votes, template AND listing); 50 is ample.
        changes: 50,
      },
    );
    const { pageInfo, nodes } = res.transactions;
    // Nodes arrive oldest→newest within a page even under `last`; reverse so
    // callers see newest-first and "first match wins" means "newest wins".
    for (const tx of [...nodes].reverse()) {
      for (const change of tx.effects?.objectChanges.nodes ?? []) {
        if (!change.idCreated) continue;
        const type = change.outputState?.asMoveObject?.contents?.type.repr;
        if (type?.endsWith(createdTypeSuffix)) out.push(change.address);
      }
    }
    if (!pageInfo.hasPreviousPage || !pageInfo.startCursor) break;
    cursor = pageInfo.startCursor;
  }
  return out;
}
