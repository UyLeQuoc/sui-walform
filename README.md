# WalForm

**Build forms that can't be taken down. Own the data. Encrypt by default.**

WalForm is a decentralized form builder on Sui. Creators get drag-and-drop authoring; respondents get mainstream UX (any wallet or Google-via-zkLogin); and every form, every submission, every access rule lives on Sui, Walrus, and Seal. No operator can suspend your form. No server can read your submissions. Not even us.

> **Walrus Session 2 — Form Tooling submission.**
> Same outcome as paid services like Walgo for per-form Walrus Sites, but **zero platform fee** — the creator's wallet pays Walrus + Sui directly; nothing routes through us.

## Links

| | |
| --- | --- |
| 🌐 **Production** | <https://walform.wal.app> — builder + landing, fully on Walrus, SuiNS-linked |
| 🎥 **Demo video** | <https://www.youtube.com/watch?v=rj-9wWFJjBg> |
| 🪼 **DeepSurge** | <https://www.deepsurge.xyz/projects/c277abc4-f5c6-486b-bf7c-f6f760de0ba1> |
| 📋 **Submission form (dogfood)** | Created via WalForm itself — see [`docs/SUBMISSION.md`](docs/SUBMISSION.md) |

---

## Live deploy

### Mainnet (production)

| Field | Value |
| --- | --- |
| `packageId` | `0xb0268669794e23d88eb07370735edcf6e70a0618fd31409834b1cd665d9c5303` |
| `originalPackageId` | `0x0128bec074eff2c7ad03b52f45321c529958f75633d74668373e890d23fb64bb` (Seal identity namespace) |
| `TransferPolicy<FormTemplate>` | `0xeee9b6d63805e7f01e1dd9c7d329e8a67c19484cf6e22a28836cc0111f6ce928` |
| `PlatformTreasury` | `0xd3576e1e42ab8dbccfe23c43b9e8b6da78daabd010d2a069809d1277da41530d` |
| Public submit allowlist | `0x85a5a93abe3db84a80a49fcf31dc198a90ca6050825820b4381cf9257e01cb6a` |

### Testnet

| Field | Value |
| --- | --- |
| `packageId` | `0x61074d22c927255c82ba5e54c3a30ffb25a2dd3d2ceb8edf874de820a2ff1fa7` |
| `originalPackageId` | `0x2d8b918defc43b3b72afe63364f9b974c636b5820082d9a64b031e5e6d977289` |
| `TransferPolicy<FormTemplate>` | `0x83aa03fd820e5fb8cbbf5e215a0b200694b4f1527e58de35e3398624b2d73554` |
| `PlatformTreasury` | `0xfea2d0b3f4d87ec5ad0bbf6326295b2002d5a35f011e908e9d426446eca8fac6` |
| Public submit allowlist | `0x1b03227377844701191890b743010be3e2eab3706927be613b56064eb71d6c4c` |

The UI flips between networks at runtime — change via the dropdown in the wallet button (defaults to mainnet). Active state per network is tracked in [`apps/contracts/deployed.{mainnet,testnet}.json`](apps/contracts). Full progress: [`docs/PROGRESS.md`](docs/PROGRESS.md). Authoritative spec: [`docs/PRD.md`](docs/PRD.md).

---

## Why WalForm

Traditional form builders (Google Forms, Typeform, Tally) host your forms on AWS, store submissions in a centralized database, and can suspend your account at any time. Existing Web3 form tools improved wallet auth and token gating but kept centralized backends.

WalForm is different end-to-end:

- **Form schema** lives inline in a Sui `Form` shared object — no server to take it down. For Private forms with `NEXT_PUBLIC_ENABLE_SEALED_SCHEMA=true`, the schema itself is Seal-encrypted, so even reading the questions requires being on the allowlist.
- **Submissions** are **Seal-encrypted client-side** before they ever hit chain. The ciphertext is stored inline in a Sui `Submission` object (so no Walrus WAL needed on the hot path). Only the creator and the submitter themselves can decrypt.
- **Ownership** is a transferable Sui object: `FormOwnerCap`.
- **Access control** is enforced by Move smart contracts: **Public · Private (allowlist) · Token-gated · Paid** — wired end-to-end. Token-gating is enforced client-side; Paid forms route fees into a per-form `FormTreasury` the creator can withdraw from.
- **Wallet support is broad.** Any Sui-standard wallet works — Slush, Sui Wallet, or Google via Enoki zkLogin. Users sign and pay gas with their connected wallet.
- **Form delivery is optionally decentralized.** Forms work out-of-the-box at `/f/{id}` (Mode A, served by the builder). Mode B is a single shared static shell at `packages/walform-site/` deployable to Walrus per-form via the user's wallet.
- **Marketplace** for templates: free + paid (multi-buyer) listings, with a 10% royalty to the platform treasury. Cover images and file uploads go to Walrus via the SDK.
- **AI is BYOK and free-by-default.** Generate forms from prompts using Vercel AI SDK v4 + OpenRouter (free model `google/gemini-2.0-flash-exp:free`); your key never leaves your browser.

WAL is consumed only for cover images, file attachments, and Mode B static shell deploys.

---

## What's working today

- ✅ Drag-and-drop form authoring with 18 field types (incl. `file` upload to Walrus) + theme editor + AI generate
- ✅ Publish on-chain in 4 access modes — Public / Private (per-form allowlist) / Token-gated / Paid
- ✅ Encrypted submissions (Seal), one personal-message sign per session
- ✅ Sealed schemas for Private forms (gated behind feature flag)
- ✅ Results dashboard with Seal decrypt + CSV export
- ✅ Submitter receipt — submitter can decrypt their own submission anytime
- ✅ Marketplace tab — browse + clone-free + buy paid templates (multi-buyer flow)
- ✅ My Forms split into Drafts (IDB) / On-chain Running / Ended / Marketplace
- ✅ Form lifecycle ops: close form, copy share link, view responses, withdraw treasury, retry treasury creation
- ✅ Cover images + file uploads via `@mysten/walrus` SDK
- ✅ Mode B Walrus Site deploy — browser-side Walrus push + per-form Site object PTB + manage dialog

Full row-by-row status: [`docs/PROGRESS.md`](docs/PROGRESS.md).

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Monorepo | Turborepo + Bun |
| Builder app (`apps/builder`) | Next.js 15 App Router, full SSR, deployed on Vercel |
| Mode B static shell (`packages/walform-site`) | Next.js 15 with `output: 'export'`, hash-routed `#/f/{id}`, deployed to Walrus per-form via the builder's Deploy button |
| Portal (`apps/portal`) | **Vendored from [`MystenLabs/walrus-sites/portal`](https://github.com/MystenLabs/walrus-sites/tree/main/portal)** — Cloudflare Worker flavor, configured for Sui + Walrus testnet (local dev only — production uses public `wal.app`) |
| UI | shadcn/ui primitives + Tailwind, shared via `packages/core` |
| Wallet / dApp | `@mysten/dapp-kit` 1.0.x — auto-detects all installed Sui-standard wallets |
| zkLogin | `@mysten/enoki` `registerEnokiWallets` on the client (Google sign-in only — no app-level signing) |
| Storage | Walrus testnet (`@mysten/walrus`) — server-side via `/api/walrus/upload` for cover images + file attachments; user wallet for Mode B deploys |
| Encryption | Seal testnet (`@mysten/seal`) — submission policy + sealed-schema policy v2 |
| AI | Vercel AI SDK v4 + `@ai-sdk/openai` pointed at OpenRouter (BYOK, default free model) |
| Smart contracts | Move 2024, 8 modules deployed + 2 upgrades on testnet |

---

## Repo layout

```
walform/
├── apps/
│   ├── builder/     Next.js 15, full SSR — dashboard, canvas,
│   │                /api/walrus/upload, Mode A renderer at /f/[id],
│   │                Results dashboard, Submitter receipt at /f/[id]/receipt
│   ├── portal/      Vendored MystenLabs/walrus-sites/portal (local dev only)
│   └── contracts/   Move 2024 package — 8 modules, 2 upgrades on testnet
│       ├── sources/   form, form_owner_cap, allowlist, submission,
│       │              template, seal_policies, payment, events
│       ├── tests/     40 unit tests (Move test)
│       ├── scripts/   publish.ts, upgrade.ts, codegen.ts
│       └── deployed.json (live testnet ids)
├── packages/
│   ├── core/         Single shared library — shadcn primitives, field renderers,
│   │                 <FormPreview>, Zod schemagen, IDB drafts, Sui wiring
│   │                 (providers, wallet UI, codegen, tx builders), Seal
│   │                 helpers, Walrus client, AI generate, Tailwind preset.
│   ├── walform-site/ Mode B static shell — Next.js output:'export',
│   │                 hash-routed #/f/{id}, ready to push to Walrus.
│   ├── eslint-config/, prettier-config/, tsconfig/  Shared dev configs.
├── docs/
│   ├── PRD.md         Authoritative spec + decision log
│   └── PROGRESS.md    Row-by-row implementation status
├── package.json       Bun workspaces root
├── turbo.json
└── bun.lockb
```

---

## Smart contracts

Deployed to **Sui mainnet** at `0xb0268669…5d9c5303` (current `packageId`; bumps on upgrade) with `originalPackageId = 0x0128bec0…23fb64bb` (stable; used as the Seal identity namespace). Mirrored to testnet at `0x61074d22…20a2ff1fa7` for hackathon judges. Latest upgrade adds the preview-then-publish marketplace flow: `purchase_template_only` + `record_free_clone` so buyers edit in Drafts before going live, instead of getting a live shared Form on click.

Modules in [`apps/contracts/sources/`](apps/contracts/sources/):

- `form.move` — `Form` (schema inline, max 100 KB) + `FormSettings` (4 access modes) + `FormStats`. Mutators: `update_schema`, `update_settings`, `close_form`, `set_site_object_id`, `set_cover_blob_id`.
- `form_owner_cap.move` — transferable ownership cap.
- `allowlist.move` — per-form `Allowlist` shared object (VecSet members) + `AllowlistCreated` event for indexing.
- `submission.move` — `submit` + `submit_paid` + their `_and_share` variants. Encrypted body (max 200 KB) + nonce inline.
- `seal_policies.move` — `seal_approve_read_submission`, `seal_approve_submit`, `seal_approve_read_form_schema`, `seal_approve_read_template_schema`. Whitelist patterns matching the PRD §9.3.
- `template.move` — `FormTemplate` + `TemplateListing` + multi-buyer `clone_paid` flow. Legacy 1-of-1 Kiosk path retained as fallback.
- `payment.move` — per-form `FormTreasury` for paid submissions; owner-gated `withdraw_all`.
- `events.move` — centralized event types.

40 Move unit tests under [`apps/contracts/tests/`](apps/contracts/tests/) — all green. Run with `bun run contracts:test`.

---

## Getting started

Prereqs: Bun 1.3+, Sui CLI + `suiup` (only if you publish/upgrade contracts).

```bash
# 1. Install everything
bun install

# 2. Boot the dev stack (builder :3000 + portal :8080 in parallel)
bun run dev
# Or run individually:
bun run dev --filter=builder                    # just the builder
bun run dev --filter=@walform/walform-site      # Mode B shell on :3002

# 3. Type-check + lint everything
bun run typecheck
bun run lint

# 4. (Optional) Re-publish or upgrade contracts on testnet.
#    The current testnet package is live + tracked in apps/contracts/deployed.json.
bun run contracts:test
bun run contracts:publish                # first deploy (writes deployed.json)
bun run contracts:upgrade                # subsequent upgrades (preserves originalPackageId)
bun run contracts:codegen                # regenerate TS bindings into packages/core/src/sui/gen/
```

### Env files

Each app has its own `.env.local`:

| App | Template | Notes |
| --- | --- | --- |
| `apps/builder/.env.example` | `WALRUS_ADMIN_SECRET_KEY`, `NEXT_PUBLIC_*` | Server-side keypair only pays Walrus storage for `/api/walrus/upload` (cover images + file attachments). Does NOT sign Sui transactions on behalf of users — every Sui tx is signed and paid by the user's connected wallet. |
| `apps/portal/.env.example` | `RPC_URL_LIST`, `AGGREGATOR_URL_LIST`, etc. | Build-time vars for the vendored portal (local dev only). |
| `apps/contracts/.env.local` | `SUI_DEPLOYER_PRIVATE_KEY` | Required only when publishing or upgrading contracts. |

---

## Mode B: deploy a form site to Walrus

The Mode B static shell lives at [`packages/walform-site/`](packages/walform-site). It's bundled and mirrored into the builder's `public/walform-site-bundle/` so the Deploy button can read it at runtime.

```bash
# 1. Build the static shell + mirror it into the builder
bun run build --filter=@walform/walform-site
bun run --cwd packages/walform-site bundle:mirror

# 2. From the builder UI, open any on-chain form card → "Deploy to Walrus"
#    The browser pushes the bundle to Walrus via the connected wallet
#    (single tx for Walrus registration), then runs the Site PTB to
#    create the per-form Site object and mirror its id onto the Form.
```

The deploy resolves at `https://<base36(siteId)>.wal.app/#/f/{formId}` once Walrus epochs activate.

---

## How judges can verify

- **Sui mainnet:** open the package id [`0xb0268669…5d9c5303`](https://suivision.xyz/package/0xb0268669794e23d88eb07370735edcf6e70a0618fd31409834b1cd665d9c5303) on Suivision. Same on [testnet](https://testnet.suivision.xyz/package/0x61074d22c927255c82ba5e54c3a30ffb25a2dd3d2ceb8edf874de820a2ff1fa7). Browse `Form` shared objects, `Submission` shared objects (encrypted bodies visible — decryption gated by Seal), `FormTemplate` + `TemplateListing` objects, `PlatformTreasury` accrued royalties.
- **All 4 access modes:** publish a form in each (Public/Private/Token/Paid), then submit. Suiscan shows the access mode in the Form object's `settings.access_mode`. Token-gating is honor-system on-chain (contract comment) — UI enforces it pre-submit.
- **Seal:** submit with account A, then try to decrypt with account B (denied), then with account A or the form owner (allowed). For Private forms with sealed schemas, even *viewing the questions* requires being on the allowlist.
- **Marketplace:** clone a paid template from the Marketplace tab — Sui explorer shows the buyer paying listed price + 10%, with the 10% flowing into `PlatformTreasury` and the listed price routed to the seller via `clone_paid`.
- **AI client-side:** open browser dev tools on the builder. Click "Generate with AI" in the editor toolbar, paste an OpenRouter free key, generate a form. Network tab shows calls going directly to `openrouter.ai` — no WalForm server in the loop.
- **Walrus:** attach a cover image or file upload — `apps/builder/app/api/walrus/upload/route.ts` PUTs the bytes via the SDK and returns an aggregator URL. Resolves at the public `aggregator.walrus-testnet.walrus.space` endpoint.

---

## Key design decisions (summary)

| | |
| --- | --- |
| Encrypted submission body | **Inline in Sui `Submission` object** — not Walrus. Inline keeps reads + decrypts to a single Sui RPC call per page. |
| Form schema | **Inline in Sui `Form` object** (cap 100 KB). Sealed for Private forms when feature flag is on. |
| Transaction model | Every WalForm tx is signed and paid by the user's connected wallet via `useSignAndExecuteTransaction`. No app-level sponsorship and no `/api/sponsor` route. |
| Two `packageId` concepts | Current `packageId` (bumps on upgrade) for MoveCall targets; stable `originalPackageId` for Seal identity namespace + object type matching. |
| Result visibility | Seal whitelist: creator + submitter only. No time-locked / reader-allowlist in v1. |
| Wallet support | Any Sui-standard wallet + Enoki zkLogin (Google) — wallet UI is shadcn-native, not dApp Kit defaults. |
| Marketplace | Multi-buyer `TemplateListing` + `clone_paid_and_share` (template stays alive after sale, `clone_count` bumps). Legacy 1-of-1 Kiosk path retained for older templates. |
| AI | BYOK via Vercel AI SDK v4 + OpenRouter `compatibility: 'compatible'`. Default free model. Key in localStorage, never leaves the browser. |
| Form distribution | **Mode A** default: builder serves `/f/{id}`. **Mode B** opt-in: shared static shell at `packages/walform-site/` deployed to Walrus per-form via the user's wallet. |

Full rationale + supersession history: [`docs/PRD.md` Appendix A](docs/PRD.md).

---

## Credits

Built on:

- [Sui](https://sui.io/) — Move 2024 smart contracts, Kiosk, TransferPolicy
- [Walrus](https://walrus.xyz/) — decentralized blob storage for cover images, file attachments, Mode B static shell
- [Seal](https://seal.mystenlabs.com/) — identity-based threshold encryption, whitelist policies for submissions and schemas
- [Enoki](https://enoki.mystenlabs.com/) — zkLogin (Google sign-in)
- [MystenLabs/walrus-sites/portal](https://github.com/MystenLabs/walrus-sites/tree/main/portal) — vendored Walrus Sites gateway
- [Vercel AI SDK](https://ai-sdk.dev/) — AI runtime for BYOK form generation
- [shadcn/ui](https://ui.shadcn.com/), [Next.js](https://nextjs.org/), [Turborepo](https://turborepo.com/), [Bun](https://bun.sh/)

---

## Status

Walrus Session 2 — Form Tooling submission. Builder live at <https://walform.wal.app>. See [`docs/PROGRESS.md`](docs/PROGRESS.md) for row-by-row status and known issues; [`docs/SUBMISSION.md`](docs/SUBMISSION.md) for the registration form answer template.
