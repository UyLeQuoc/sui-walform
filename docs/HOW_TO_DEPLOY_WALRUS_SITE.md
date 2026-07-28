# How to Deploy the WalForm Walrus Site

WalForm's builder app (Mode A) is a static Vite SPA hosted on **Walrus Sites** at
[walform.wal.app](https://walform.wal.app). "Deploying" = build the static `out/`, push it to Walrus,
and update the on-chain `site::Site` object in place. This guide covers **mainnet**; testnet is the
same with `--context testnet` and a faucet-funded wallet.

## Prerequisites

| Thing | Value / location |
| --- | --- |
| `site-builder` CLI | `~/.local/bin/site-builder` (v2.8.0+) |
| `walrus` CLI + config | `~/.local/bin/walrus`, config `~/.config/walrus/client_config.yaml` |
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
  deploy ./apps/builder/out --epochs 4 \
  --object-id 0x3e0573ec782ce73c50126e9e315473a09d8eef4dbcaa12ea27d8ac1a5b82f05e
```

- Global flags (`--context`, `--config`) go **before** the `deploy` subcommand.
- `deploy` is the unified command: it publishes if the site is new, or **updates** the object given
  by `--object-id`. Do **not** mix `update … deploy` (two subcommands → error).
- `deploy` diffs against the live site and only re-uploads **changed** blobs.
- `--epochs 4` = storage duration (1 mainnet epoch ≈ 14 days, so ~8 weeks).

### 4. Switch your wallet back

```bash
sui client switch --address <your-dev-address>
sui client switch --env testnet
```

### 5. Verify

On success the CLI prints `Execution completed`, a list of created/deleted resources, and the Site
object id. Browse via `walform.wal.app` (a SuiNS name pointing at the Site object) or the base36
`*.localhost` portal URL printed by the tool.

Cost per update is small (only changed blobs) — a typical run is ≈ **0.005 SUI + 0.09 WAL**.

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
