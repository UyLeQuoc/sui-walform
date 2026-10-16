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
 * ⚠️ ENDPOINT CHOICE IS LOAD-BEARING — it must serve FULL history. Every event
 * scan in this app enumerates from the beginning of time (a reviewers tracker
 * or marketplace template can be months old), so a pruning endpoint silently
 * drops old templates, submissions and trackers.
 *
 * Which provider keeps full history has flipped, so measure, don't assume:
 * - 2026-07-17/28: official pruned to a rolling window (`ReviewersCreated` only
 *   back ~18 days; 155/247 `SubmissionCreated`) while ZAN had everything.
 * - 2026-10-01: official returned all 381 mainnet `SubmissionCreated` back to
 *   2026-05-13, while ZAN started at 2026-07-11 (missing 105 submissions, 36
 *   forms, 7 of 9 templates, all 3 paid listings).
 * Both agreed on the newest events each time, so it's retention, not lag.
 * `NEXT_PUBLIC_SUI_GRAPHQL_{TESTNET,MAINNET}` overrides the official default.
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
