/**
 * Sui GraphQL RPC transport.
 *
 * WHY THIS EXISTS: Sui is decommissioning public JSON-RPC (testnet week of
 * 2026-07-06, mainnet week of 2026-07-20, full protocol deactivation
 * 2026-07-31). gRPC replaces object/tx reads but has NO event query at all
 * (verified by reflection against a live node — see docs/RPC_MIGRATION.md), so
 * every event scan MUST go through GraphQL. That makes GraphQL mandatory, not
 * a preference.
 *
 * ⚠️ ENDPOINT CHOICE IS LOAD-BEARING — it must be a FULL-HISTORY indexer.
 * Sui's official GraphQL serves fresh state (unlike its JSON-RPC fullnode:
 * verified 2026-07-17, object 0x661d2a50… at v939333850 with all 4 members
 * while JSON-RPC still returned v883961553) but it PRUNES event history to a
 * rolling window — measured the same day, it exposed `ReviewersCreated` only
 * back to 2026-06-29 (~18 days) where a full-history indexer returned all 35
 * events back to 2026-05-13. Both agreed on the newest event, so this is
 * pruning, not lag.
 *
 * Every event scan in this app enumerates from the beginning of time (a
 * reviewers tracker or marketplace template can be months old), so a pruning
 * endpoint silently drops old templates, submissions and trackers. Point
 * `NEXT_PUBLIC_SUI_GRAPHQL_{TESTNET,MAINNET}` at a full-history indexer; the
 * official default below is a key-free fallback that is only correct for
 * recent data.
 *
 * Note the trade-off being made: a managed indexer's key ships in the public
 * JS bundle (as any `NEXT_PUBLIC_*` does) and must be origin-restricted in
 * that provider's dashboard.
 */

import type { WalformNetwork } from '../env-network';

const DEFAULT_GRAPHQL_TESTNET = 'https://graphql.testnet.sui.io/graphql';
const DEFAULT_GRAPHQL_MAINNET = 'https://graphql.mainnet.sui.io/graphql';

export function getSuiGraphqlUrl(network: WalformNetwork): string {
  if (network === 'mainnet') {
    return process.env.NEXT_PUBLIC_SUI_GRAPHQL_MAINNET?.trim() || DEFAULT_GRAPHQL_MAINNET;
  }
  return process.env.NEXT_PUBLIC_SUI_GRAPHQL_TESTNET?.trim() || DEFAULT_GRAPHQL_TESTNET;
}

/** A GraphQL error entry as returned in the `errors` array. */
interface GraphqlError {
  message?: string;
}

interface GraphqlResponse<T> {
  data?: T;
  errors?: GraphqlError[];
}

/**
 * POST a GraphQL query and return `data`, throwing on transport or GraphQL
 * errors. GraphQL answers 200 OK with an `errors` array on a bad query, so a
 * response-level check is required — `r.ok` alone would swallow failures and
 * surface them later as confusing "undefined is not an object" reads.
 */
export async function suiGraphqlRequest<T>(
  network: WalformNetwork,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const url = getSuiGraphqlUrl(network);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Sui GraphQL ${network} HTTP ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as GraphqlResponse<T>;
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message ?? 'unknown').join('; ');
    throw new Error(`Sui GraphQL ${network}: ${msg}`);
  }
  if (!json.data) throw new Error(`Sui GraphQL ${network}: empty response`);
  return json.data;
}
