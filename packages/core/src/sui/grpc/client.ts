/**
 * Sui gRPC transport — the app's only object/transaction read path.
 *
 * WHY THIS EXISTS: Sui decommissioned public JSON-RPC. Testnet's
 * `fullnode.testnet.sui.io` already answers HTTP 404 to any `sui_*` call
 * (verified 2026-07-27; the node itself is healthy — it still serves
 * `x-sui-checkpoint-height` headers, it just no longer speaks JSON-RPC), and
 * mainnet's shuts off 2026-07-31. gRPC is the official replacement for object,
 * balance, coin and transaction reads.
 *
 * Events are NOT here. gRPC exposes no event-query method at all (verified by
 * reflection against a live node — LedgerService / StateService /
 * SubscriptionService between them offer object, tx, balance, dynamic-field and
 * checkpoint-subscribe calls and nothing else), so every event scan goes
 * through `../graphql/events.ts` instead. See docs/RPC_MIGRATION.md.
 *
 * ENDPOINT: the official fullnode, deliberately. Its gRPC serves current state
 * (checked 2026-07-27) and, unlike the official GraphQL, it does not prune —
 * pruning only bites history scans, which is exactly why events stay on a
 * full-history indexer while point reads come from here. `access-control-allow-origin: *`
 * and `access-control-allow-headers: *` on the preflight, so gRPC-web works
 * straight from the browser with no proxy and no API key in the bundle.
 *
 * Override per-network with `NEXT_PUBLIC_SUI_GRPC_{TESTNET,MAINNET}` when you
 * want a dedicated (higher rate limit) provider. Anything gRPC-web over HTTPS
 * works; the transport posts to `<baseUrl>/sui.rpc.v2.<Service>/<Method>`.
 */

import { GrpcWebFetchTransport, SuiGrpcClient } from '@mysten/sui/grpc';

const DEFAULT_GRPC_TESTNET = 'https://fullnode.testnet.sui.io';
const DEFAULT_GRPC_MAINNET = 'https://fullnode.mainnet.sui.io';

/**
 * `||` rather than `??`: the build inlines an unset var as `undefined`, but an
 * env file with an empty value inlines `""`, which must also fall back.
 */
export function getSuiGrpcUrl(network: string): string {
  if (network === 'mainnet') {
    return process.env.NEXT_PUBLIC_SUI_GRPC_MAINNET?.trim() || DEFAULT_GRPC_MAINNET;
  }
  return process.env.NEXT_PUBLIC_SUI_GRPC_TESTNET?.trim() || DEFAULT_GRPC_TESTNET;
}

/**
 * One client per network, cached. `SuiClientProvider` calls its `createClient`
 * inside a `useMemo` keyed on the factory identity, so returning a fresh client
 * per call would rebuild every downstream memo (Seal client, Walrus client)
 * on each render.
 */
const clients = new Map<string, SuiGrpcClient>();

export function getSuiGrpcClient(network: string): SuiGrpcClient {
  const cached = clients.get(network);
  if (cached) return cached;
  const client = new SuiGrpcClient({
    network,
    transport: new GrpcWebFetchTransport({ baseUrl: getSuiGrpcUrl(network) }),
  });
  clients.set(network, client);
  return client;
}

const officialClients = new Map<string, SuiGrpcClient>();

/**
 * A client pinned to Mysten's public fullnode, ignoring any env override.
 *
 * Only one caller needs this: `WalrusWalletSigner` waits for a tip-payment tx
 * to be visible on the PUBLIC node before handing the upload to a Walrus
 * relay, because the relay verifies payment against its own RPC pool rather
 * than ours. Checking that on a private endpoint would prove nothing.
 */
export function getOfficialSuiGrpcClient(network: 'testnet' | 'mainnet'): SuiGrpcClient {
  const cached = officialClients.get(network);
  if (cached) return cached;
  const baseUrl = network === 'mainnet' ? DEFAULT_GRPC_MAINNET : DEFAULT_GRPC_TESTNET;
  const client = new SuiGrpcClient({
    network,
    transport: new GrpcWebFetchTransport({ baseUrl }),
  });
  officialClients.set(network, client);
  return client;
}
