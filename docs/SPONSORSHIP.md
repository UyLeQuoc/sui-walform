# Creator-funded Walrus sponsorship

A form's creator funds a **SponsorPool**. Respondents can then submit with **0 WAL and 0 SUI**, while
still being the **sender** of their own Walrus uploads (their address on Walruscan, not the
platform's). The pool pays storage and upload-relay tips, a gas sponsor (Enoki) pays SUI gas, and
the platform takes a small fee on the storage it sponsors.

Status: **live on both networks** — testnet v6, mainnet v3, each with a `SponsorConfig`; the Enoki
function and walform.wal.app were redeployed on 2026-10-02. Only the zero-balance check on
production (step 6) is left — see [Mainnet rollout](#mainnet-rollout).

## Why this design

Requirements from the Walrus team conversation:

1. The respondent — not the platform — is the sender of the blob write.
2. The form creator funds it ("I set up a form and add X to sponsor people registering").
3. The platform takes a small cut.
4. Storage of older forms can be extended.

The previous Railway sponsor (`services/walrus-sponsor`) and hosted services like
walrus-sponsor.krill.tube both write with the **sponsor's** key, which breaks (1). A Sui sponsored
transaction keeps `sender = respondent` while `gas owner = sponsor`; the WAL comes from an on-chain
pool instead of the respondent's wallet.

## How it works

### Contract — `walform::sponsor_pool` (`apps/contracts/sources/sponsor_pool.move`)

| Object | Owner | Purpose |
|---|---|---|
| `SponsorConfig` | shared, one per network | Platform fee (bps, capped at 20%) and Walrus price **ceilings**. Created/updated with `PlatformAdminCap`. |
| `SponsorPool` | shared, one per form | WAL for storage, SUI for relay tips, per-pool limits, stats. Opened with the form's `FormOwnerCap`; **anyone** can deposit, only the owner can withdraw/pause. |
| `SponsorReceipt` | hot potato (no abilities) | Must be settled in the same transaction it was borrowed in. |

One sponsored blob registration, all in the respondent's own PTB:

```
[relay auth payload]                                   ← MUST be input 0 (upload relay rule)
(coin, receipt) = sponsor_pool::borrow(pool, config, form, allowlist, clock, amount)
tip             = sponsor_pool::take_relay_tip(pool, &mut receipt, tip)   → relay address
blob            = walrus::system::register_blob(…, reserve_space(…, coin), …, coin)
sponsor_pool::settle(pool, config, receipt, &blob, coin)
transfer(blob, respondent)
```

**Walrus is called from the PTB, never from our module.** `walrus::system` mutators assert
`system.version == VERSION`; a module calling them would abort after every Walrus upgrade until
re-linked. `settle` only reads `Blob`/`Storage` getters, which have no version gate.

### What stops a PTB from draining the pool

| Guard | Where |
|---|---|
| The sender must be able to submit right now (form open, before deadline, under the cap, on the allowlist for private forms) | `borrow` |
| Loan ≤ pool's `max_wal_per_upload`; tip ≤ `max_tip_per_upload`; per-address upload quota | `borrow` / `take_relay_tip` |
| The receipt can't be dropped — the loan must be settled against a real `Blob` | type system |
| WAL spent ≤ cost of the blob's reserved storage at the platform's price ceilings | `settle` |
| Each blob settles once, and only while uncertified (fresh) | `settle` |
| Worst-case platform fee is reserved at borrow time | `borrow` |

Residual risk, by design: a malicious PTB can skim at most the gap between the ceilings and the live
price (ceilings are live × 1.25 → ≤ 20% of one upload's cost), plus the relay tip. Public forms are
sybil-able (fresh addresses get fresh quota), bounded by the pool balance the creator chose to put
in. Allowlist forms aren't.

### Respondent flow (`packages/core`)

The upload relay authenticates a registration by an auth payload in **input 0**, so each blob needs
its own register tx. They are pipelined — each register tx also certifies the previous blob:

| Submission | Transactions the respondent signs |
|---|---|
| no attachments | 2 — register body · certify body + submit |
| with attachments | 3 — register quilt · register body + certify quilt · certify body + submit |

(Wallet-paid today: 3 without attachments, 5 with.)

Attachments go in one quilt whose patch ids are computed **before** registration, so the encrypted
body can reference them. Each blob is certified as early as the pipeline allows, but all of them are
wrapped as `walrus::shared_blob::SharedBlob`s (anyone can `fund` and `extend` one) in the final
certify + submit tx, next to the Submission. Storage discovery relies on that.

Code map:

| File | Role |
|---|---|
| `walrus/sponsored-register.ts` | Framework-free protocol: prepare, pre-flight check, register, relay upload, certify + share |
| `forms/services/sponsored-submission.ts` | Orchestrates a submission; returns `unavailable` only if nothing was spent |
| `forms/hooks/use-form-submission.ts` | Tries the pool first, falls back to the existing wallet-paid path |
| `forms/hooks/use-form-sponsor-pool.ts`, `use-sponsor-pool-actions.ts` | Pool discovery (via `SponsorPoolCreated` events) and creator actions |
| `forms/components/results/SponsorPool{Panel,Setup,Overview}.tsx`, `SponsorFundingFields.tsx` | Manage tab card: status, open & fund, balances (≈ uploads left), top up, pause, withdraw. Shows "Testnet only" on a network without a config instead of hiding. |
| `forms/components/submit/SponsoredStorageBanner.tsx` | Form page strip telling respondents they don't need WAL (live, funded pools only) |
| `forms/components/list/SponsoredPoolChip.tsx` | My Forms card chip: "Sponsored · 0.6 WAL", amber when paused or empty |
| `supabase/functions/sponsor-transaction` | Enoki allowlist: new targets, live Walrus package, relay tip address |

Fallback: if the pool can't pay (paused, empty, over a limit, Walrus above the price ceiling) or the
first transaction fails, the hook falls back to wallet-paid uploads — nothing was spent. A wallet
**rejection** is not retried. Paid forms (`accessMode 3`) never use the pool: they charge SUI at
submit anyway.

### Extending storage (separate from sponsorship)

Extending doesn't need a pool. **Every** submission's blobs become SharedBlobs in its submit tx:
the sponsored path above, and the wallet-paid path too (`sui/tx/share-blobs.ts :: addShareBlobs`
appended to the submit tx, no extra signature). The Results → Manage tab's **Walrus storage** card
(`FormStoragePanel.tsx`, `forms/hooks/use-form-storage.ts`) finds them by scanning the form's
transactions (`walrus/form-blobs.ts` — every submit takes `&mut Form`) and extends every live one by
N epochs, paid from the creator's wallet (`fund` + `extend` per SharedBlob, one tx). Walrus charges
`units × storage price × epochs` with no write fee; expired blobs can't be revived; nothing can go
past `max_epochs_ahead` (53).

Not extendable by the creator: responses submitted before this change (the Blob is owned by the
respondent; the card counts them), attachments uploaded via the Railway sponsor (it doesn't report
the Blob object), and attachment quilts of the few testnet sponsored submissions made before the
share moved into the submit tx.

## Measured on testnet

`bun run packages/core/scripts/smoke-sponsored-upload.ts` — 25 checks, all passing. It drives the
same `submitSponsored` the UI calls, with a fresh respondent holding 0 SUI / 0 WAL.

| | Result |
|---|---|
| Respondent is sender of every tx; gas paid by someone else | ✓ |
| Respondent balance after | 0 SUI, 0 WAL |
| Pool cost, one submission (body + 2-file quilt, 2 epochs) | 0.0016004 WAL (storage 0.0015242 + fee 0.0000762) + 210 MIST tips |
| Pool accounting | exact to the FROST |
| Data read back from the aggregator | byte-identical |
| Extend both blobs by 1 epoch | exact cost, 0 WAL left stranded |

Move unit tests: `bun run contracts:test` — 79/79 (20 new, incl. real `Blob`s via Walrus's test
system: diversion, double-settle, quota, allowlist, closed/expired forms, caps, fees).

## Packages and versions

Every version of every network is logged in [`apps/contracts/PACKAGES.md`](../apps/contracts/PACKAGES.md)
and `deployed.<network>.json :: packageHistory` (`bun run contracts:package-log` rebuilds both from
chain).

| | testnet | mainnet |
|---|---|---|
| walform current | v6 `0x3246afea…` (adds `sponsor_pool`) | v3 `0xeddb1e70…` (adds `sponsor_pool`) |
| Linked Walrus / WAL | `0x849e95d2…` / `0x8270feb7…` | `0x98da433a…` / `0x356a26eb…` |
| SponsorConfig | `0x58c9964e…` — 500 bps, ceilings 3785 / 7552 | `0x8af42c6f…` — 500 bps, ceilings 83063 / 150570 |

Notes for anyone touching the contracts:

- `Move.toml` was migrated to the new package system (required to depend on Walrus's packages). The
  migration is bytecode-neutral — verified identical module bytes and digest before/after.
- `walrus` and `wal` are pinned to a Walrus git commit and resolved per network
  (`[dep-replacements.testnet]`). Building for mainnet needs the sui CLI on mainnet;
  `scripts/upgrade.ts` switches and restores the env itself.
- **Types added by an upgrade are addressed by the version that added them**, not by
  `originalPackageId`. `sponsor_pool` types/events live under v6 on testnet — hence
  `NEXT_PUBLIC_SPONSOR_TYPES_PACKAGE_ID_*`. (Same story as `reviewers` on testnet.)
- The v6 upgrade also shipped commit `9597143` (input size caps; template-schema Seal check `>=` →
  `==`). Reviewed: the client has always used exactly 32-byte template identities, and the new caps
  can't block existing templates from being cloned.
- `scripts/upgrade.ts` now reads/writes only `deployed.<network>.json` — the old version read
  `deployed.json` (a mainnet mirror) even for testnet. It refuses to run if the file disagrees with
  chain, simulates and prints the cost first (`--dry-run` stops there), and signs through
  `sui keytool sign` — no private key in env or on disk.

## Mainnet rollout

| Step | Status |
|---|---|
| 1. Upgrade to v3 (`0xeddb1e70…`, tx `2GkxL2hs…`, 0.216 SUI) | ✅ 2026-10-01 |
| 2. `SponsorConfig` `0x8af42c6f…` at 500 bps (tx `HqF6LwpP…`) | ✅ 2026-10-01 |
| 3. Ids in `deployed.mainnet.json`, `PACKAGES.md`, `apps/builder/.env.local` | ✅ |
| 4. Deploy the Enoki function (Supabase `sponsor-transaction`: v3 + Walrus targets + relay tip; `ALLOWED_ORIGIN` set) | ✅ 2026-10-02 |
| 5. Rebuild + redeploy the site (bundle `index-BnLjq6wy.js`, 0.005871 SUI + 0.088376 WAL) | ✅ 2026-10-02 |
| 6. Verify with a fresh zero-balance wallet | ⏳ |

Step 4 had to precede step 5: `.env.local` points mainnet MoveCalls at v3, and the function now
accepts both v2 (the live site) and v3. Verified after deploy: a mainnet create from
`https://walform.wal.app` returns 200, every Move call and recipient of a sponsored submission is on
the allowlist. **Testnet:** Enoki answered 429 to every request on 2026-10-02 (old package too) —
an Enoki account limit on testnet, not this change; the app falls back to wallet-paid gas there.

Next: rebuild + redeploy per [`HOW_TO_DEPLOY_WALRUS_SITE.md`](HOW_TO_DEPLOY_WALRUS_SITE.md). That
deploy also ships the GraphQL switch to the official indexer (ZAN was missing history — see
`packages/core/src/sui/graphql/client.ts`). The deployer wallet holds ~0.095 SUI after steps 1–2.

## Operating it

- **Walrus raises prices past the ceilings** → sponsored submissions fall back to wallet-paid until
  `bun run contracts:sponsor-config --update` (re-reads live prices).
- **Walrus upgrades its package** → nothing to do: the PTB and the Enoki allowlist use the live
  package id. Bump the pinned `rev` in `Move.toml` at the next walform upgrade.
- **Platform fees** accrue in each pool; `sponsor_pool::sweep_fees` (permissionless) moves them to the
  config, `withdraw_fees` (admin) pays them out.
- **Who may call the gas sponsor** — `ALLOWED_ORIGIN` on the Supabase function is
  `https://walform.wal.app,https://*.wal.app,http://localhost:3000`. `*` is one subdomain label, so
  per-form Mode B sites keep working. Origin only stops other *websites*; scripts can send any Origin
  header, so the Move-call allowlist + Enoki's budget are what bound spending. Watch the Enoki budget:
  when it runs out, respondents need SUI for gas (WAL is still pool-paid).
- **The deployer wallet is admin-only** — upgrades, `sponsor-config`, fee withdrawals, site deploys.
  Nothing in the respondent or creator flow spends from it.

## Known limitations

- A failure **after** the first transaction (e.g. relay down mid-upload) surfaces as an error; retrying
  starts over and spends the pool again. No resume yet.
- Pool discovery scans all `SponsorPoolCreated` events client-side — fine now, needs an index at
  scale. Storage discovery is per form (its own transactions), so it scales with the form.
- Paid forms don't use pools.
- The Railway sponsor is still wired as the fallback for attachments on forms **without** a pool
  (platform as sender there). Remove it once pools are live on mainnet if that matters.
