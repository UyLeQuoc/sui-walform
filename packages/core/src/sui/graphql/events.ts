/**
 * GraphQL replacement for JSON-RPC `client.queryEvents`.
 *
 * gRPC cannot serve this — it has no event-query method at all (verified by
 * reflection: LedgerService/StateService/SubscriptionService expose object, tx,
 * balance, dynamic-field and checkpoint-subscribe calls, and nothing else). So
 * every event scan in the app routes here. See docs/RPC_MIGRATION.md.
 *
 * Shape parity with `queryEvents` is deliberate — the call sites are cursor
 * loops, so this keeps `{ data, hasNextPage, nextCursor }` and returns the same
 * payloads `parsedJson` did (GraphQL's `contents.json`, verified identical).
 * Only the cursor type changes: an opaque string instead of
 * `{ txDigest, eventSeq }`.
 *
 * Verified against mainnet 2026-07-17: paging `ReviewersCreated` returns
 * exactly 35 events — the same count JSON-RPC reported.
 */

import type { WalformNetwork } from '../env-network';
import { suiGraphqlRequest } from './client';

export type EventOrder = 'ascending' | 'descending';

export interface EventsPage<T> {
  /** Event payloads, mirroring JSON-RPC's `parsedJson`. */
  data: T[];
  hasNextPage: boolean;
  /** Opaque cursor — feed straight back in as `cursor` to continue. */
  nextCursor: string | null;
}

interface EventsQueryResponse {
  events: {
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
    nodes: { contents: { json: unknown } }[];
  };
}

// Two query strings rather than one with nullable args: the Relay spec makes
// passing both `first` and `last` an error, and servers differ on whether an
// explicit-null variable counts as "passed". Building the direction in is
// unambiguous.
const ASC_QUERY = `query WalformEventsAsc($type: String!, $first: Int!, $after: String) {
  events(filter: { type: $type }, first: $first, after: $after) {
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    nodes { contents { json } }
  }
}`;

const DESC_QUERY = `query WalformEventsDesc($type: String!, $last: Int!, $before: String) {
  events(filter: { type: $type }, last: $last, before: $before) {
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    nodes { contents { json } }
  }
}`;

/**
 * Fetch one page of events of `eventType`.
 *
 * `order: 'descending'` walks backwards from the newest event — GraphQL has no
 * `order` argument, so it maps to backward pagination (`last`/`before`) with
 * each page's nodes reversed, which yields newest-first exactly like
 * `queryEvents({ order: 'descending' })` did.
 */
export async function queryEventsGql<T = unknown>(opts: {
  network: WalformNetwork;
  /** Fully-qualified type, e.g. `${pkg}::reviewers::ReviewersCreated`. */
  eventType: string;
  limit?: number;
  cursor?: string | null;
  order?: EventOrder;
}): Promise<EventsPage<T>> {
  const { network, eventType, limit = 50, cursor = null, order = 'ascending' } = opts;
  const descending = order === 'descending';

  const res = await suiGraphqlRequest<EventsQueryResponse>(
    network,
    descending ? DESC_QUERY : ASC_QUERY,
    descending
      ? { type: eventType, last: limit, before: cursor }
      : { type: eventType, first: limit, after: cursor },
  );

  const { pageInfo, nodes } = res.events;
  // Nodes always arrive oldest→newest within a page, even under `last`.
  const ordered = descending ? [...nodes].reverse() : nodes;

  return {
    data: ordered.map((n) => n.contents.json as T),
    // Walking backwards, "is there more" is hasPreviousPage, and the cursor to
    // continue from is the page's start.
    hasNextPage: descending ? pageInfo.hasPreviousPage : pageInfo.hasNextPage,
    nextCursor: descending ? pageInfo.startCursor : pageInfo.endCursor,
  };
}

/**
 * Page through the whole event stream of `eventType` and return every payload.
 *
 * Use this instead of a single large-`limit` call: JSON-RPC silently capped
 * `queryEvents` at 50 per page, so call sites asking for `limit: 200` were
 * quietly reading only the first 50 and dropping the rest. Paginating makes
 * the full-scan intent explicit and correct.
 *
 * `maxPages` is a runaway guard, not a product limit — hitting it means the
 * stream outgrew a client-side scan and needs a real index.
 */
export async function collectEventsGql<T = unknown>(opts: {
  network: WalformNetwork;
  eventType: string;
  order?: EventOrder;
  pageSize?: number;
  maxPages?: number;
}): Promise<T[]> {
  const { network, eventType, order = 'ascending', pageSize = 50, maxPages = 100 } = opts;
  const out: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const res: EventsPage<T> = await queryEventsGql<T>({
      network,
      eventType,
      order,
      limit: pageSize,
      cursor,
    });
    out.push(...res.data);
    if (!res.hasNextPage || !res.nextCursor) break;
    cursor = res.nextCursor;
  }
  return out;
}
