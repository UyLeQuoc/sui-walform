# How to Deploy the WalForm Walrus Site

WalForm's builder app (Mode A) is a static Vite SPA hosted on **Walrus Sites** at
[walform.wal.app](https://walform.wal.app). "Deploying" = build the static `out/`, push it to Walrus,
and update the on-chain `site::Site` object in place. This guide covers **mainnet**; testnet is the
same with `--context testnet` and a faucet-funded wallet.

## Prerequisites

| Thing | Value / location |
| --- | --- |
| `site-builder` CLI | `~/.local/bin/site-builder` — **v2.12.0+** |
| `walrus` CLI + config | `~/.local/bin/walrus` — **v1.55.2+**, config `~/.config/walrus/client_config.yaml` |
| `sui` CLI | must have a `mainnet` env and the **owner wallet** in the keystore |
| `sites-config.yaml` | repo root (`contexts: testnet/mainnet`, `default_context: mainnet`) |
| **Site object id** | `0x3e0573ec782ce73c50126e9e315473a09d8eef4dbcaa12ea27d8ac1a5b82f05e` |
| **Owner wallet** | `0x86fcc7fdc63be1a6b31c5288e7b87a6b985f16d1af490fcb54f2501d5fa8e78c` (alias `zealous-crocidolite`) |
| Funding | owner wallet needs **SUI** (gas) + **WAL** (storage) on mainnet |

Only the **owner wallet** (the `AddressOwner` of the Site object) can update the site.

## Steps

### 1. Build the static output

Build the Mode B bundle **first** (its build mirrors `dist/` into
`apps/builder/public/walform-site-bundle/`), then the builder app — so `out/` picks up the fresh
bundle. Running them in this order avoids a turbo race where the builder copies `public/` before the
mirror finishes.

```bash
bun run build --filter=@walform/walform-site   # builds + mirrors the Mode B bundle
bun run build --filter=builder                 # builds apps/builder/out
```

Output: `apps/builder/out/` (Mode A app + `walform-site-bundle/` for Mode B + `ws-resources.json`).

### 2. Switch to the site-owner wallet

```bash
sui client switch --address 0x86fcc7fdc63be1a6b31c5288e7b87a6b985f16d1af490fcb54f2501d5fa8e78c
sui client switch --env mainnet
sui client balance    # confirm there's SUI (gas) + WAL (storage)
```

Note your previous active address/env so you can switch back afterwards.

### 3. Deploy (updates the existing site in place)

```bash
site-builder --context mainnet --config ./sites-config.yaml \
  deploy ./apps/builder/out --epochs 10 \
  --object-id 0x3e0573ec782ce73c50126e9e315473a09d8eef4dbcaa12ea27d8ac1a5b82f05e
```

- Global flags (`--context`, `--config`) go **before** the `deploy` subcommand.
- `deploy` is the unified command: it publishes if the site is new, or **updates** the object given
  by `--object-id`. Do **not** mix `update … deploy` (two subcommands → error).
- `deploy` diffs against the live site and only re-uploads **changed** blobs.
- `--epochs 10` = storage duration (1 mainnet epoch ≈ 14 days, so ~4.6 months). A **shorter**
  `--epochs` never shortens already-paid resources — it just declines to pay for an extension — so
  the flag only ever costs you the gap between a blob's current expiry and the requested one.
  Check the runway before picking a number:

  ```bash
  walrus --context mainnet info      | grep "Current epoch"   # e.g. 39
  walrus --context mainnet list-blobs | grep -v expired       # "Exp. epoch" column
  ```
- **`--object-id` is mandatory, not optional.** `site-builder` normally reads `object_id` from the
  deploy directory's `ws-resources.json`, but `apps/builder/out/ws-resources.json` is a *build
  artifact* copied from `apps/builder/public/ws-resources.json`, which has no `object_id`. Every
  rebuild (including a Turborepo cache restore) therefore wipes it. Omit the flag and site-builder
  **publishes a brand-new site** — burning WAL and orphaning the `walform.wal.app` SuiNS record.
  Verify with `grep object_id apps/builder/out/ws-resources.json` before deploying; on success
  site-builder writes it back.
- Do not pass `--ws-resources`: the default (`ws-resources.json` inside the deploy directory) is
  correct, and `apps/builder/walrus/ws-resources.mainnet.json` does not exist.

### 4. Switch your wallet back

```bash
sui client switch --address <your-dev-address>
sui client switch --env testnet
```

### 5. Verify

On success the CLI prints `Execution completed`, a list of created/deleted resources, and the Site
object id. Browse via `walform.wal.app` (a SuiNS name pointing at the Site object) or the base36
`*.localhost` portal URL printed by the tool.

Cost per update is small (only changed blobs). Measured on 2026-09-09 (23 MB `out/`, 133 files,
25.9 MiB quilt), both runs from epoch 39 — in each case the Walrus estimate matched the charge
**to the FROST**:

| Run | SUI gas | WAL |
| --- | --- | --- |
| Content deploy, `--epochs 2` (re-stored 3 expired blobs) | 0.008450 | 0.056025 |
| `--epochs 10` on the *same* content — 0 new storage, extended 1 blob by 8 epochs | 0.001300 | 0.117533 |
| 2026-10-02 sponsorship release, `--epochs 9` from epoch 40 (= the site's existing expiry, 49) — no extensions | 0.005871 | 0.088376 |
| 2026-10-02 standalone storage-extend release, `--epochs 9` from epoch 40 — no extensions | 0.009362 | 0.086939 |
| 2026-10-16 referral release, `--epochs 8` from epoch 41 — no extensions | −0.007873 (net: storage rebate from 10 deleted resources > gas) | 0.056838 |
| 2026-10-16 invite-hint release, `--epochs 8` from epoch 41 — estimate said 0.055914 WAL, actual far lower (freed storage reused) | 0.002905 | 0.010351 |

Note the shape: **extending storage costs more than uploading the content did**. Pick the epoch
count you actually want on the first run rather than bumping it afterwards.

Rule of thumb for updates: `--epochs = <site's current expiry epoch> − <current epoch>`. New
resources then expire with the old ones and nothing gets extended. Read both with
`walrus --context mainnet info` and `walrus --context mainnet list-blobs`.

The site is currently paid through **epoch 49 (~2027-01-26)**.

## Gotcha: RPC — everything must be gRPC, and `--dry-run` is broken on mainnet

Sui turned **JSON-RPC off on public fullnodes** (mainnet 2026-07-31). `walrus` ≥1.55 and
`site-builder` ≥2.12 are gRPC clients, so all three configs must point at a **gRPC-capable**
fullnode — `https://fullnode.mainnet.sui.io:443`:

| Config | Field | Used by |
| --- | --- | --- |
| `sites-config.yaml` | `contexts.mainnet.general.rpc_url` | forwarded to the `walrus` subprocess as `--rpc-url` (it **overrides** walrus's own config) |
| `~/.sui/sui_config/client.yaml` | `envs[alias: mainnet].rpc` | site-builder's own `RetriableSuiClient` (`SiteManager::new`) |
| `~/.config/walrus/client_config.yaml` | `contexts.mainnet.rpc_urls` | `walrus` when site-builder forwards nothing |

**Do not point these at a JSON-RPC-only provider** (ZAN, BlockVision, PublicNode — none of them
serve Sui gRPC). The symptom is a gRPC framing error, because the client is parsing an HTTP 404
JSON body as a gRPC frame:

```
protocol error: received message with invalid compression flag: 123
(valid flags are 0 and 1) while receiving response with status: 404 Not Found
```

(`123` is `{` — the start of the 404's JSON body.) The mirror-image symptom, from pointing a
JSON-RPC call at Mysten's fullnode, is:

```
Method not found. JSON-RPC on public fullnodes has been deprecated.
```

**`--dry-run` cannot work on mainnet right now.** It is the one code path that still needs
JSON-RPC: `SiteManager::dry_run_ptb` calls `dev_inspect_transaction_block` over JSON-RPC and is
still marked `TODO(grpc-migration)` in site-builder 2.12. It builds that client from the *same*
wallet env URL that `SiteManager::new` uses for gRPC, so one URL would have to serve both
protocols — and no public endpoint does. `--dry-run` therefore dies right after printing the
Walrus estimate:

```
Estimated Walrus Storage Cost for this publish/update:
56024966 FROST
Error during execution: ErrorObject { code: MethodNotFound, ... }
```

That Walrus number is still trustworthy — it is the storage cost, and it matched the real deploy
to the FROST. Only the SUI-gas half of the estimate is lost, and gas is bounded by `gas_budget`
(0.3 SUI) and has run ~0.008 SUI in practice. **Real deploys are unaffected** — they never call
`dry_run_ptb`.

## Gotcha: "could not find WAL/SUI coins with sufficient balance" while the wallet has funds

Sui can hold funds as an **address balance** instead of coin objects (wallets and exchanges increasingly
send that way). `getBalance` reports both (`coinBalance` + `addressBalance`), but the `walrus` CLI (1.55)
behind `site-builder` only spends **coin objects**, so "Storing quilts to Walrus" fails even with plenty
of funds — for WAL (storage), and for SUI too: it reserves **one SUI coin ≥ `gas_budget`** (0.05 SUI)
and errors with `could not find SUI coins with sufficient balance [requested_amount=Some(50000000)]`.
Nothing on-chain has changed at that point — the Site object is untouched.

Move some of each from the address balance into a coin object, then re-run the deploy:

```bash
SUI_NETWORK=mainnet bun run apps/contracts/scripts/balance-to-coin.ts --coin WAL --amount 1     # --dry-run to simulate
SUI_NETWORK=mainnet bun run apps/contracts/scripts/balance-to-coin.ts --coin SUI --amount 0.3
```

## Gotcha: `MoveAbort` in `walrus … system::inner_mut`

If the deploy fails at **"Applying the Walrus Site object updates on Sui"** with an error like:

```
MoveAbort(MoveLocation { ... walrus ...::system, function_name: Some("inner_mut") }, 1) in command 0
Error: initial PTB transaction failed
```

…the `walrus_package` in `sites-config.yaml` (`contexts.mainnet.general.walrus_package`) is **stale** —
Walrus mainnet upgraded its package since the last deploy. The blobs from the failed attempt are
already stored; only the Sui PTB failed, so **production is untouched** and you can just fix + retry.

Get the current package id from the mainnet Walrus **system object**:

```bash
curl -s -X POST https://fullnode.mainnet.sui.io:443 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"sui_getObject","params":["0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2",{"showContent":true}]}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['data']['content']['fields']['package_id'])"
```

Put that value into `sites-config.yaml`:

```yaml
contexts:
  mainnet:
    general:
      walrus_package: 0x98da433aa0139512c210597b1c5e3df6cd121d8d77f8652691bb66fadfc8aa1b  # ← current
```

then re-run the deploy from step 3.

> The `0x2134d5…` system object and `0x98da433a…` package id above are the current mainnet values as
> of this writing. The system object id is stable across Walrus upgrades; the `package_id` field it
> holds is what moves — always re-read it from chain rather than trusting a hardcoded value.

## Gotcha: `asked version SequenceNumber(N) is higher than the latest SequenceNumber(N-1)`

A **transient RPC lag** during "Storing quilts to Walrus":

```
Error: client internal error: No object changes in transaction response:
["... asked version SequenceNumber(944144462) is higher than the latest SequenceNumber(944144461)"]
```

The fullnode's indexed view of an object is one version behind what the just-submitted tx expects.
It's not a config or funding problem — **just re-run the deploy** (step 3); the node catches up within
seconds. Already-stored quilts are reused, so the retry is quick.

## Notes

- The Mode B (per-form Walrus Site) shell bundle is shipped as part of the main site under
  `walform-site-bundle/`. It's mirrored by `packages/walform-site`'s build, which is why step 1
  builds walform-site first.
- `ws-resources.json` (in `apps/builder/public/`, copied to `out/`) defines routes + cache headers +
  site metadata. `site-builder deploy` rewrites its own bookkeeping fields there on success.
- After a contract upgrade unrelated to Walrus, no site redeploy is needed — the site only changes
  when `apps/builder/out` changes.
