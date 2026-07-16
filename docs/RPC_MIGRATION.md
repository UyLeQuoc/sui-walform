# JSON-RPC → GraphQL/gRPC migration (deadline 2026-07-31)

Every fact below was **verified empirically** against mainnet on 2026-07-16. Don't
re-litigate them — re-run the probes only if something looks wrong.

## Why (urgent)

Sui is shutting JSON-RPC down:

- Testnet public JSON-RPC: **week of 2026-07-06** (already happening)
- Mainnet public JSON-RPC: **week of 2026-07-20**
- Full protocol-level deactivation: **2026-07-31**

This is **already biting us**: `fullnode.mainnet.sui.io` returns a tx as executed
while its object store still reports the pre-tx version — so freshly-added
reviewers were invisible and `site-builder` deploys failed with
`asked version N is higher than the latest M`. It is **not** transient lag.

## Verified facts

| Claim | Evidence |
| --- | --- |
| Official mainnet endpoint is **stale over BOTH protocols** | JSON-RPC + gRPC both return object `0x661d2a50…` at v883961553; suiscan/ZAN return v939333850. 5/5 calls stale — not an LB fluke. |
| gRPC does **NOT** have an event query | `.core` exposes `getObjects`/`listOwnedObjects`/`listCoins`/`getTransaction`/`listDynamicFields` — no `queryEvents` equivalent. Events must go **GraphQL**. |
| gRPC returns **raw BCS** for object content | `getObject({include:{content:true}})` → `content: {"0":102,"1":29,…}` (bytes), not parsed `fields`. Decoding needs the Move struct layout. |
| **GraphQL returns parsed JSON** | `object(address:…){ asMoveObject { contents { json } } }` → `{form_id, owner, members:{contents:[…]}}`. Browser-native (plain HTTP). |
| GraphQL **can** replace `queryEvents` | `events(filter:{ type:"…::reviewers::ReviewersCreated" }, first:N){ pageInfo{hasNextPage} nodes{ contents{ json } } }` → same payload as `parsedJson`. NOTE: the filter field is **`type`**, not `eventType`. |
| gRPC has **no** event query — proven by reflection | `grpcurl … list` → LedgerService (GetObject/BatchGetObjects/GetTransaction/GetCheckpoint/GetEpoch), StateService (GetBalance/ListBalances/GetCoinInfo/ListOwnedObjects/ListDynamicFields), SubscriptionService (SubscribeCheckpoints only), TransactionExecution/MovePackage/NameService/SignatureVerification. **Zero event-query methods.** |
| gRPC `Object` has **no** parsed field — proven by reflection | `describe sui.rpc.v2.Object` → `optional Bcs contents = 8; // BCS bytes of a Move struct value`. No `json`/`fields`. `read_mask` can only select among these fields. |
| Sui's **official GraphQL is fresh** where its JSON-RPC is stale | `graphql.mainnet.sui.io/graphql` returned object `0x661d2a50…` at v939333850 with all 4 members, while `fullnode.mainnet.sui.io` JSON-RPC still returned v883961553. Testnet GraphQL also fine (chainId `69WiPg3D…`, within ~3 checkpoints of ZAN). |
| ⚠️ …but the **official GraphQL PRUNES event history** | Paging `ReviewersCreated`: official returned **4** events (oldest 2026-06-29, ~18 days back); ZAN returned **35** (oldest 2026-05-13). Both agreed on the newest event → pruning, not lag. **Every event scan here enumerates from genesis, so a pruning endpoint silently hides old templates / submissions / trackers.** The GraphQL endpoint MUST be a full-history indexer. |
| dApp Kit is **injectable** | `SuiClientProvider` has `createClient?: (name, config) => …`, and `useSuiClientQuery` dispatches `client[method](params)` → an adapter exposing JSON-RPC method names works without touching call sites. |
| ZAN gRPC-web works from a browser | Must pass a **custom transport** — `SuiGrpcClient`'s constructor does NOT forward `meta`. See snippet below. |

### ZAN endpoints

```ts
// gRPC-web (browser) — headers are the key; constructor `meta` is IGNORED.
import { SuiGrpcClient, GrpcWebFetchTransport } from '@mysten/sui/grpc';
const transport = new GrpcWebFetchTransport({
  baseUrl: 'https://grpc.zan.top',
  meta: { 'x-token': API_KEY, 'x-network': 'sui-mainnet' }, // or sui-testnet
});
const client = new SuiGrpcClient({ network: 'mainnet', transport });
```

```
GraphQL: https://api.zan.top/node/v1/sui/<network>/<API_KEY>/graphql
native gRPC (Node/CLI): grpc.zan.top:443  -H "x-token: …" -H "x-network: sui-mainnet"
```

ZAN is the only provider on Mysten's list with **GraphQL on both testnet AND
mainnet** (everyone else is mainnet-only) — WalForm needs both networks.

## Plan

**Target GraphQL for the frontend, not gRPC** — gRPC's raw-BCS content would force
us to decode Move layouts client-side, while GraphQL already returns the parsed
shape the app's parsers want. And gRPC simply cannot do events at all, so GraphQL
is mandatory regardless.

Status: **events ✅ migrated** (step 3). **Object/tx reads ❌ still JSON-RPC**,
riding the ZAN endpoint as a bridge — that is the remaining work before
2026-07-31 (steps 1, 2, 5 below, plus `queryTransactionBlocks` in
`use-template-listing` / `use-form-treasury`).

1. **Adapter** (`packages/core/src/sui/graphql-compat-client.ts`): expose the
   JSON-RPC method names the app calls, backed by ZAN GraphQL, mapping responses
   back to the shapes the existing parsers expect. Inject via
   `SuiClientProvider createClient`. Methods actually used by the app:
   `getObject`, `multiGetObjects`, `getOwnedObjects`, `queryEvents`, `getBalance`,
   `getCoins`, `getTransactionBlock`, `queryTransactionBlocks`, `waitForTransaction`.
2. **Shape gap to close**: JSON-RPC nests Move structs as `X.fields.Y`; GraphQL's
   `contents.json` does not (`members.contents`, not `members.fields.contents`).
   Either normalize inside the adapter or update the parsers
   (`parseReviewers`, `use-form-on-chain`, `use-on-chain-forms`, …).
3. **Event call sites (6) — ✅ DONE (2026-07-17).** All six now go through
   `packages/core/src/sui/graphql/events.ts` (`queryEventsGql` for cursor loops,
   `collectEventsGql` for full scans), backed by
   `packages/core/src/sui/graphql/client.ts` +
   `NEXT_PUBLIC_SUI_GRAPHQL_{TESTNET,MAINNET}`:
   `use-form-reviewers` (ReviewersCreated), `use-form-submissions`
   (SubmissionCreated), `use-marketplace-templates` (TemplatePublished),
   `use-marketplace-votes` (TemplateVotesInitialized), `use-form-allowlist`
   (AllowlistCreated), `use-reviewing-forms` (ReviewerAdded).

   Verified against mainnet: the shim pages **35/35** `ReviewersCreated` events
   (same count JSON-RPC gave), descending is the exact reverse of ascending, and
   it resolves tracker `0x661d2a50…` for form `0xfb3e9fe4f7…` — the tracker the
   reviewer-bug digest mutated.

   Bonus fix: `use-form-allowlist` and `use-reviewing-forms` passed `limit: 200`
   in ONE call, which JSON-RPC silently capped at 50 — so a reviewer added
   before the 50 most recent adds never saw their form under "Reviewing". Both
   now paginate the full stream.

   Official shape (docs + verified against ZAN):

   ```graphql
   {
     events(filter: { type: "0xPKG::module::EventName" }, after: null, first: 50) {
       nodes { contents { json } timestamp sender { address } }
       pageInfo { hasNextPage endCursor }
     }
   }
   ```

   Mapping from the current calls:

   | JSON-RPC `queryEvents` | GraphQL `events` |
   | --- | --- |
   | `query: { MoveEventType: X }` | `filter: { type: X }` (field is `type`, NOT `eventType`) |
   | `limit: 50` | `first: 50` |
   | `cursor` / `nextCursor` / `hasNextPage` | `after` / `pageInfo.endCursor` / `pageInfo.hasNextPage` |
   | `ev.parsedJson` | `nodes[].contents.json` (same payload) |
   | `order: 'descending'` | no `order` arg — use backward pagination (`last`/`before`) |

   Other filters available: `sender`, `module` (cannot combine with `type`),
   `atCheckpoint` / `afterCheckpoint` / `beforeCheckpoint`.
4. **Bonus, kills an event scan**: add `reviewers_id: Option<address>` to `Form`
   (mirror the existing `site_object_id` pattern in `form.move`, already used by
   Mode B) + `set_reviewers_id`. Then the reviewers tracker is a direct field read
   — no event scan, no index. Needs a contract upgrade + a one-time migration for
   existing forms (fall back to the event scan for legacy ones).
5. **Deploy tooling** (`site-builder`/`walrus` CLI) reads its RPC from
   `~/.sui/sui_config/client.yaml` (NOT the walrus config). Point it at a
   gRPC-capable fresh endpoint. Suiscan is JSON-RPC-fresh but its gRPC lacks
   `listOwnedObjects` (525) — use ZAN/a paid provider.

## Security

The ZAN key ships in the public JS bundle (any `NEXT_PUBLIC_*` does). **Restrict it
by origin/referrer in the ZAN dashboard** to `walform.wal.app`.

## Cost lesson

Failed `site-builder` deploys are **not free**: the quilt store tx succeeds and
spends WAL, then the client errors reading back object changes. Retrying re-pays.
~4.4 WAL was burned this way. Fix the RPC before retrying a deploy.
