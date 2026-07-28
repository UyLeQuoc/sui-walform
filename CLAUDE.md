# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

WalForm — decentralized form builder on Sui. Stack runs on both mainnet (production at walform.wal.app) and testnet (selectable via env):

- **Sui Move contracts** (`apps/contracts/sources/*.move`) own form schemas, submissions, allowlists, templates, Kiosk royalty, Seal policies.
- **Seal** encrypts submission bodies + form schemas client-side, via Mysten's decentralized **committee** key servers behind a hosted aggregator (testnet 3-of-5, keyless; mainnet 5-of-8, **requires an Enoki-issued key sent as `X-API-Key`**). ⚠️ **A ciphertext is bound to the key servers it was encrypted under** — changing `NEXT_PUBLIC_SEAL_KEY_SERVERS_*` breaks every ciphertext written before the change ("Not enough shares"). Retired servers go in `NEXT_PUBLIC_SEAL_LEGACY_KEY_SERVERS_*`; `useSealClient()` encrypts (active only) and `useSealDecryptClient()` returns a **resolver** that picks the client matching each ciphertext. Never merge active + legacy into one `SealClient` — a mixed committee/V1 client decrypts neither.
- **Wallet model** — every WalForm tx (creator publish/update/close, respondent submit, marketplace clone/buy, Mode B deploy) is signed and paid by the user's connected wallet via dApp Kit's `useSignAndExecuteTransaction`. No app-level transaction sponsorship; Enoki is used only for `registerEnokiWallets` (Google sign-in).
- **Walrus** is opt-in only (cover images, FILE_UPLOAD, Mode B site shell) — base flow is zero WAL by storing schema + ciphertext inline in Sui objects.
- **Frontend** — both apps are **Vite 7 + React 19 + react-router-dom v7 static SPAs** (no SSR, no API routes; everything ships static to Walrus Sites). Tailwind v4 via `@tailwindcss/vite`; fonts via `@fontsource-variable/*` loaded in `packages/core/src/ui/fonts.ts` (CSS vars in `ui/globals.css`); theme via `@teispace/next-themes/client`. `process.env.NEXT_PUBLIC_*` is kept in source and text-replaced at build by `packages/build-config :: nextPublicDefine` (so `core` stays bundler-agnostic). Migrated off Next.js 2026-06-02.

Read [`docs/PRD.md`](docs/PRD.md) for binding architectural decisions (Appendix A is the authoritative log) and [`docs/PROGRESS.md`](docs/PROGRESS.md) for current implementation state + ordered next-up queue.

**Before writing any code, read [`docs/CODE_RULES.md`](docs/CODE_RULES.md) — binding rules for component/hook split, state buckets, memoization, file layout, TypeScript, and async patterns. New code that conflicts with CODE_RULES is wrong even if surrounding code drifted from it.**

## Workspace layout

| Workspace | What it is |
| --- | --- |
| `apps/builder` | **Vite 7 + react-router-dom v7 SPA** → static `out/` (deploys to Walrus Sites). Entry `index.html` + `src/main.tsx` → `src/router.tsx` (flat routes) → `src/routes/*`. Creator dashboard, authoring canvas, `/forms` list (Drafts / My Forms / Marketplace tabs), Mode A renderer at `/f?formId=…`, Results at `/forms/results?formId=…`. Query-string ids (no dynamic path segments). No server routes — fully static; Walrus writes run browser-side from the user's wallet. |
| `apps/contracts` | Move 2024 package + publish/upgrade/codegen scripts. `deployed.json` tracks `packageId` (bumps on upgrade) and `originalPackageId` (stays stable — Seal identity namespace). |
| `apps/portal` | Vendored from `MystenLabs/walrus-sites/portal`. **Local dev only** — production uses public `wal.app`. Resolves `{base36}.localhost:8080` to testnet Walrus blobs. |
| `packages/core` | Single shared library. Imports from any app. Holds shadcn primitives (`src/ui/*`), all forms code (`src/forms/*` — components, hooks, IDB drafts, store), Sui wiring (`src/sui/*` — providers, `useExecuteTransaction` helper, wallet UI, codegen bindings, tx builders), Seal helpers (`src/crypto/*`). |
| `packages/{eslint-config,prettier-config,tsconfig}` | Shared dev configs. `eslint-config/react` (used by both apps) pins `react.version` (not `'detect'`) — ESLint 10 + eslint-plugin-react 7.37 crash on auto-detect. |
| `packages/build-config` | Shared Vite helper. `nextPublicDefine(mode, dir)` builds the `define` map that text-replaces `process.env.NEXT_PUBLIC_*` tokens at build time; both apps' `vite.config.ts` import it (relatively) and pass `apps/builder` as the env dir (Vite's `loadEnv` reads `.env`, `.env.local`, `.env.{mode}` from there). |
| `packages/walform-site` | Mode B static shell — **Vite 7 SPA** → `dist/`, hash/config-routed (`#/f/{formId}` or baked `config.json`), router-free. The builder's Deploy button bundles + pushes per form via the user's connected wallet (`WalrusWalletSigner`); Sui `site::Site` PTB also signed by user. `dist/` is mirrored into `apps/builder/public/walform-site-bundle/` by `scripts/mirror-bundle.ts`. |

## Commands

Bun + Turborepo. Always run from repo root unless a script says otherwise.

```bash
bun install                                  # workspace setup
bun run dev                                  # boots builder :3000 + portal :8080
bun run dev --filter=builder                 # just builder
bun run typecheck                            # MUST stay green before any merge
bun run build                                # MUST stay green before any merge
bun run lint                                 # eslint across workspaces
bun run format                               # prettier write

# Move contracts
bun run contracts:test                       # sui move test
bun run contracts:publish                    # first-time deploy → writes deployed.json
bun run contracts:upgrade                    # subsequent upgrades — preserves originalPackageId
bun run contracts:codegen                    # regenerate TS bindings into packages/core/src/sui/gen/
bun run contracts:setup-public-allowlist     # one-off: shares a global throwaway Allowlist for public submits

# Lower-level Move
cd apps/contracts && sui move build          # quick compile check (not part of turbo)
cd apps/contracts && sui move test            # 40+ unit tests across modules
```

## Big-picture architecture

### Three architectural pillars (they all interact)

1. **User-paid transaction transport (every on-chain action)** — `packages/core/src/sui/use-execute-transaction.ts :: useExecuteTransaction` is the single hook every action goes through. It wraps dApp Kit's `useSignAndExecuteTransaction` with a pinned `chain: 'sui:${network}'`. The user's wallet signs and pays gas. There is NO server-side signing route. Adding a new MoveCall is purely a client-side change to a tx builder under `packages/core/src/sui/tx/*.ts` plus the hook that calls `execute({ transaction })`.

2. **Source of truth split: IDB ↔ chain** — Drafts live in IndexedDB (`packages/core/src/forms/services/form-db.ts`), surfaced via `useForms()`. My Forms + Marketplace fetch from chain via `useOnChainForms()` / `useMarketplaceTemplates()` / `useFormOnChain()` / `useFormSubmissions()`. After every successful on-chain mutation, callers MUST `await invalidateChain(digest)` (`packages/core/src/sui/use-invalidate-chain.ts`) — it waits for finality then invalidates dApp Kit's `[network]` query key prefix. After publish, `formDb.delete(formId)` clears the draft so it disappears from the Drafts tab. `formDb` mutations dispatch a `walform:forms-changed` window event that `useForms()` listens for.

3. **Two packageId concepts** — `packageId` (current, bumps on every `contracts:upgrade`) is for MoveCall targets. `originalPackageId` (stable across upgrades) is the Seal identity namespace AND the type prefix Sui uses in `objectType`. Use `useActivePackageId()` for tx builders, `useOriginalPackageId()` for `seal.encrypt({packageId})` and for matching object types in `extractPublishIds`. Object types in Sui RPC always use `originalPackageId`, regardless of which version performed the create.

### Marketplace flow (multi-buyer paid templates)

Sui Kiosk's `purchase` consumes the listed item — fine for NFTs, wrong for cloneable templates. The contract's `template::TemplateListing` + `clone_paid_and_share` path solves this: shared `FormTemplate` stays alive after each clone, `clone_count` bumps, payment routes to creator + 10% royalty to `PlatformTreasury`. Legacy 1-of-1 Kiosk path is kept for templates published before the upgrade. `useMarketplaceTemplates` does a 2-hop lookup to detect Kiosk-listed (template ObjectOwner is a `dynamic_field::Field` wrapper, not the Kiosk itself — walk up one level). `useTemplateListing(templateId)` queries `create_listing_and_share` tx history to resolve the per-template price.

### Seal flow

Submission body encryption is wired and shipping. Identity layout = `form.id_address(32) || nonce(16)` = 48 bytes (matches `seal_policies.move`).

**Schema-level encryption (Seal v2) is ACTIVE** when `NEXT_PUBLIC_ENABLE_SEALED_SCHEMA=true` — Private (allowlist) forms store the schema itself as a Seal ciphertext, so `useFormOnChain` returns `schema: null` + `schemaSealed: true`. Any view that renders questions must decrypt first via `useSealedSchemaDecrypt` (submit page, Results dashboard, editor all do). Forgetting this is what caused issue #12: Results showed "0 questions" and blank answers, and the editor bounced the owner to /results. Saving an edit re-encrypts (`useUpdateForm({ schemaSealed })`) so the form stays private.

SessionKey lives in `useSealSession()` — first decrypt pops one `signPersonalMessage` prompt, then the key is cached **module-level** keyed by `address:packageId` so every consumer in a view (body decrypt + schema decrypt) shares one signature. Not persisted: a refresh or wallet switch re-signs.

### Mode A vs Mode B (PRD v1.0)

`apps/builder/src/routes/PublicSubmitRoute.tsx` (`/f?formId=…`) is the always-on Mode A renderer + in-builder preview. Mode B (Walrus Site per form) is a single shared `packages/walform-site/` static shell pushed to Walrus once — per-form deploy is just a `site_object::create` PTB pointing at the shared blob, no per-form WAL spend. This supersedes the dropped `apps/renderer` per-form-export design (PRD v1.0 Appendix A 2026-04-26).

## Conventions baked into the codebase

- **No JSON-RPC. Ever.** Sui decommissioned it (testnet's public endpoint 404s already, mainnet's is off 2026-07-31). Reads split three ways:
  - **Objects / balances / coins / transactions / execution → gRPC.** `useSuiGrpcClient()` (`sui/grpc/use-grpc-client.ts`) + the helpers in `sui/grpc/objects.ts` (`getMoveObject(s)`, `listOwnedMoveObjects`, `listOwnedObjectIds`; `getJsonObject(s)` only for foreign types with no codegen). Decode with the checked-in `sui/gen/walform/*` MoveStructs — the gRPC `json` include renders `vector<u8>` as base64, indistinguishable from a Move `String`.
  - **Events → GraphQL** (`sui/graphql/events.ts`). gRPC has no event query.
  - **"Which txs called this Move function" → GraphQL** (`sui/graphql/transactions.ts`). gRPC only fetches a tx by digest.
  - The GraphQL endpoint **must be a full-history indexer** — the official one prunes and silently hides older submissions/templates/listings.
  - `useSuiClientQuery` is gone: it dispatches JSON-RPC method names. Use `useQuery` with a `[network, 'walform:…', …]` key so `useInvalidateChainQueries` still catches it.
  - **Every `useSignAndExecuteTransaction` must pass `execute: useCoreTransactionExecutor()`.** dApp Kit's default calls `client.executeTransactionBlock` and blows up at signing time, not build time.
  - Only the codegen and `providers.tsx` reference `@mysten/sui/jsonRpc`, and only for types (dApp Kit declares its context client as `SuiJsonRpcClient` while accepting any client at runtime).
- **Sui addresses must be normalized before equality.** `0x2` and `0x0000…0002` look different to a naive string comparison — `normalizeSuiAddress` from `@mysten/sui/utils` handles this. Apply it on both sides of any address comparison (object types, package ids, owner addresses).
- **Pass a `Transaction` instance to wallet-signing hooks** (not a base64 string) so dApp Kit can serialise the full tx including any gas overrides. `useExecuteTransaction` already does this.
- **Wallet UI is shadcn-native, not dApp Kit's defaults.** `<WalletButton>`, `<WalletConnectModal>`, `<WalletDropdown>`, `<WalletChip>` live under `packages/core/src/sui/wallet-ui/`. Dropdown is intentionally minimal: address + Copy, Disconnect. No network switcher in the dropdown — network is env-driven.
- **Move codegen is checked in.** `packages/core/src/sui/gen/walform/*.ts` is regenerated by `bun run contracts:codegen`. The util file at `gen/utils/index.ts` has manual non-null patches for `noUncheckedIndexedAccess: true` strict mode — re-apply if codegen overwrites them.
- **Address normalization.** `normalizeSuiAddress` from `@mysten/sui/utils` converts `0x2` → `0x0000000000000000000000000000000000000000000000000000000000000002`. Use it before any string equality on Sui addresses.
- **Drafts only carry IDB metadata.** The `publishedMeta` field on `StoredForm` is dead — drafts get deleted on successful publish, on-chain forms render from chain. Don't add per-form on-chain state to IDB.

## Hackathon target

**Sui Overflow 2026** (<https://overflow.sui.io>). The app is network-selectable: **mainnet** is the live production deploy (walform.wal.app); **testnet** is fully supported for development and for judges who prefer faucet SUI (set `NEXT_PUBLIC_DEFAULT_NETWORK=testnet`). `apps/contracts/deployed.{mainnet,testnet}.json` track the per-network records (`packageId`, `originalPackageId`, `transferPolicy`, `platformTreasury`). After every `contracts:upgrade`, mirror the relevant network's `packageId` into `apps/builder/.env :: NEXT_PUBLIC_PACKAGE_ID`. `originalPackageId` only moves on a fresh `contracts:publish` (never), so it stays in env across upgrades.

## Memory-system note

User-specific memories live at `/Users/uydev/.claude/projects/-Users-uydev-code-WalForm/memory/`. Read those before assuming user preferences (communication style, minimalist wallet UI, etc.).
