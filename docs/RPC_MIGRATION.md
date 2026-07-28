# JSON-RPC → GraphQL/gRPC migration — **DONE** (2026-07-28)

Every fact below was **verified empirically** against mainnet. Don't
re-litigate them — re-run the probes only if something looks wrong.

## Status

**The app no longer speaks JSON-RPC anywhere.**

| Read | Transport | Where |
| --- | --- | --- |
| Objects, balances, coins, transactions, execution | **gRPC** (official fullnode) | `packages/core/src/sui/grpc/{client,objects,use-grpc-client}.ts` |
| Events | **GraphQL** (full-history indexer) | `packages/core/src/sui/graphql/events.ts` |
| "Which txs called this Move function" | **GraphQL** (full-history indexer) | `packages/core/src/sui/graphql/transactions.ts` |

The single remaining `SuiJsonRpcClient` mention is a **type-only cast** in
`providers.tsx` — dApp Kit 1.1.5 declares its context client as
`SuiJsonRpcClient` while accepting any client at runtime. Nothing calls a
JSON-RPC method on it.

Verified against live mainnet 2026-07-28: **14/14 parity checks** between the
new gRPC/GraphQL paths and the JSON-RPC answers they replace — form fields,
schema bytes, owned caps, submission ciphertext/nonce/submitter, template
listing ids and prices.

## Why (urgent)

Sui shut JSON-RPC down:

- Testnet public JSON-RPC: **already dead**. `fullnode.testnet.sui.io` answers
  **HTTP 404** to every `sui_*` call (verified 2026-07-27 — the node itself is
  healthy, still serving `x-sui-checkpoint-height` headers; it just no longer
  speaks JSON-RPC).
- Mainnet public JSON-RPC: still answering as of 2026-07-27, off **2026-07-31**.

Before that it also served **stale** object state: `fullnode.mainnet.sui.io`
returned a tx as executed while its object store still reported the pre-tx
version — so freshly-added reviewers were invisible and `site-builder` deploys
failed with `asked version N is higher than the latest M`. The gRPC surface on
the same host does not have this problem (re-verified fresh 2026-07-27).

## Verified facts

| Claim | Evidence |
| --- | --- |
| Testnet JSON-RPC is **gone** | `POST fullnode.testnet.sui.io:443` with `sui_getChainIdentifier` → **HTTP 404**, while the same response carries `x-sui-checkpoint-height: 365070648`. The node is up; the protocol is off. (2026-07-27) |
| Official gRPC is **fresh + CORS-open** | `getObject(0x6)` returns the current clock; the preflight answers `access-control-allow-origin: *` and `access-control-allow-headers: *`, so gRPC-web works from the browser with no proxy and no key. (2026-07-27) |
| gRPC does **NOT** have an event query | `.core` exposes `getObjects`/`listOwnedObjects`/`listCoins`/`getTransaction`/`listDynamicFields` — no `queryEvents` equivalent. Events must go **GraphQL**. |
| gRPC does **NOT** have a transaction query | Only `GetTransaction` **by digest**. "Which txs called this Move function" (needed for `TemplateListing` + `FormTreasury` discovery) must go **GraphQL** → `transactions(filter: { function: "pkg::mod::fn" })`. |
| gRPC returns **raw BCS** for object content… | `getObject({include:{content:true}})` → bytes, not parsed `fields`. Decoding needs the Move struct layout. |
| …which is why reads use the **checked-in codegen** | `packages/core/src/sui/gen/walform/*` MoveStructs `.parse(content)` exactly. Preferred over the `json` include (added in SDK 2.20) because JSON renders `vector<u8>` as base64 — indistinguishable from a Move `String`, so a sealed schema blob and a form title would arrive as the same type. Foreign types with no codegen (`site::Site`, SuiNS) use `json` via `getJsonObject`. |
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

## What shipped

The split is **gRPC for point reads, GraphQL only for the two things gRPC
cannot do** (events, and tx-by-Move-function). An earlier draft of this plan
proposed a JSON-RPC-shaped compat adapter over GraphQL; that was dropped —
decoding BCS with the checked-in codegen is both simpler and *more* precise
than the JSON-RPC shape it would have emulated (see the `vector<u8>` vs
`String` ambiguity in the table above).

1. **Client + read helpers — ✅ DONE (2026-07-28).**
   `sui/grpc/client.ts` (per-network `SuiGrpcClient` over `GrpcWebFetchTransport`,
   env-overridable via `NEXT_PUBLIC_SUI_GRPC_{TESTNET,MAINNET}`),
   `sui/grpc/objects.ts` (`getMoveObject(s)` / `listOwnedMoveObjects` — BCS via
   codegen, batched, drops unresolvable ids instead of throwing; `getJsonObject(s)`
   for foreign types; `listOwnedObjectIds` for cap lookups), and
   `sui/grpc/use-grpc-client.ts`. Injected through `SuiClientProvider`'s
   `createClient`, so Seal / Walrus / SuiNS / `tx.build` all get it too.
2. **Call sites — ✅ DONE (2026-07-28).** Every `useSuiClientQuery(...)` is gone;
   hooks now use `useQuery` with a `[network, 'walform:…', …]` key so
   `useInvalidateChainQueries` still catches them. Migrated:
   `use-form-on-chain`, `use-on-chain-forms`, `use-form-allowlist`,
   `use-form-submissions`, `use-form-reviewers`, `use-reviewing-forms`,
   `use-marketplace-templates`, `use-marketplace-votes`, `use-template-listing`,
   `use-form-treasury`, `use-platform-treasury`, `use-platform-admin`,
   `use-form-site`, `use-template-schema`, `use-owned-suins-names`,
   `use-form-submission`, plus `extract-form-ids` / `extract-walrus-site-id`
   (JSON-RPC `objectChanges` → `effects.changedObjects` + the `objectTypes` map).

   ⚠️ **Every `useSignAndExecuteTransaction` call site must pass
   `execute: useCoreTransactionExecutor()`** (`sui/use-core-executor.ts`). dApp
   Kit's default executor calls `client.executeTransactionBlock`, which the gRPC
   client does not have — and it fails at *signing time*, not build time. Four
   call sites use it: `use-execute-transaction`, `walrus/wallet-upload`,
   `DeployToWalrusSiteButton`, `WalrusSiteManageDialog`.

   Also fixed here: `WalrusWalletSigner` was POSTing `sui_getTransactionBlock`
   to `fullnode.<net>.sui.io` to confirm a tip payment before handing an upload
   to a Walrus relay. That endpoint 404s, and a 404 body isn't JSON, so the
   `res.json()` threw an error the retry filter treated as fatal — it would have
   failed **every** Walrus upload. Now `getOfficialSuiGrpcClient(network).core.getTransaction`.
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
3b. **Transaction-history call sites (2) — ✅ DONE (2026-07-28).**
   `use-template-listing` (`TemplateListing`) and `use-form-treasury`
   (`FormTreasury`) discover their objects by scanning which txs called a Move
   function — a query gRPC does not have. Both now go through
   `packages/core/src/sui/graphql/transactions.ts :: collectCreatedObjectsGql`:

   ```graphql
   transactions(filter: { function: "pkg::module::fn" }, last: 50, before: $cursor) {
     pageInfo { hasPreviousPage startCursor }
     nodes { effects { objectChanges(last: 50) {
       nodes { address idCreated outputState { asMoveObject { contents { type { repr } } } } }
     } } }
   }
   ```

   Mapping: `filter.MoveFunction.{package,module,function}` → one
   fully-qualified `function` string; `order: 'descending'` → backward
   pagination (`last`/`before`), same as events; `objectChanges[].type === 'created'`
   → `idCreated`; `objectChanges[].objectType` → `outputState.asMoveObject.contents.type.repr`.

   `use-form-treasury` also picked up a fix in passing: it used to be keyed per
   form and fetch a fixed first page of 50 txs. It now paginates fully and
   caches one shared scan across cards, like `use-template-listing`.
4. **Bonus, kills an event scan**: add `reviewers_id: Option<address>` to `Form`
   (mirror the existing `site_object_id` pattern in `form.move`, already used by
   Mode B) + `set_reviewers_id`. Then the reviewers tracker is a direct field read
   — no event scan, no index. Needs a contract upgrade + a one-time migration for
   existing forms (fall back to the event scan for legacy ones).
5. **Deploy tooling** — needs ONE host serving BOTH gRPC and fresh JSON-RPC.
   Proven 2026-07-17 by running it three ways:

   | `client.yaml` rpc | site-builder's own client (**gRPC**, `ListOwnedObjects`) | `walrus` subprocess (**JSON-RPC**, reads back after store) |
   | --- | --- | --- |
   | `fullnode.mainnet.sui.io` | ✅ works | ❌ 1h43 stale → `asked version N > latest M` → **WAL already spent** |
   | ZAN | ❌ 404 → `invalid compression flag: 123` (`{` = a JSON body parsed as gRPC) | ✅ real-time |

   Both take the URL from **`~/.sui/sui_config/client.yaml`**. `--rpc-url` and
   sites-config `rpc_url` only steer site-builder's own client — the `walrus`
   subprocess ignores them (its log: `using Sui wallet configuration from
   '~/.sui/sui_config/client.yaml'`), which is why pointing only those at a
   fresh endpoint still burns WAL on the read-back.

   ZAN can't satisfy both: its gRPC lives on a different host
   (`grpc.zan.top`) and needs `x-token`/`x-network` headers the CLI cannot
   send. Options: a provider with both on one host and the key in the path
   (QuickNode is on Mysten's list), a local proxy that injects the headers, or
   simply wait for the official node to catch up (it was 109k checkpoints
   behind, then 27k — it closes the gap at ~2.9 checkpoints/sec) and deploy
   with the default config.

   `walrus --context mainnet list-blobs` is the FREE pre-flight: it exercises
   the same owned-objects path. Never test with `deploy` — a failed deploy
   still spends WAL (the store tx lands, the read-back is what fails).
   `deploy --dry-run` also costs nothing and prints the real estimate
   (~0.048 WAL / 0.005 SUI for this site).

6. **Node scripts — ✅ DONE (2026-07-28), UNVERIFIED AGAINST A LIVE RUN.**
   `contracts/scripts/{publish,upgrade,setup-public-allowlist}.ts`,
   `apps/builder/scripts/seed-onchain-submissions.ts` and
   `packages/walform-site/scripts/publish-to-walrus.ts` all built a
   `SuiJsonRpcClient`, so `contracts:upgrade --network testnet` was already
   broken. They now build a `SuiGrpcClient` (override with `SUI_GRPC_URL`) and
   read effects the gRPC way. Their `objectChanges` reads became
   `effects.changedObjects` + `objectTypes`, and — the one non-obvious bit — a
   **published package is a created object with `outputState: 'PackageWrite'`**
   and no `objectTypes` entry, which is how the new packageId is identified.

   These typecheck but were **not executed**: a real publish/upgrade spends SUI
   and mutates the on-chain package. Do a testnet `contracts:upgrade` before
   trusting them on mainnet.

## Security

The indexer key ships in the public JS bundle (any `NEXT_PUBLIC_*` does).
**Restrict it by origin/referrer in the provider's dashboard** to
`walform.wal.app`. The gRPC side needs no key at all — the official fullnode is
open and CORS-permissive — so the only secret in the bundle is the GraphQL one.

## Cost lesson

Failed `site-builder` deploys are **not free**: the quilt store tx succeeds and
spends WAL, then the client errors reading back object changes. Retrying re-pays.
~4.4 WAL was burned this way. Fix the RPC before retrying a deploy.
