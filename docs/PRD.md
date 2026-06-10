# WalForm — Product Requirements Document

**Status:** Draft v2.0
**Last updated:** 2026-05-07
**Target submission:** Sui Overflow 2026 Hackathon — testnet demo
**Network scope:** 100% Sui testnet + Walrus testnet for the hackathon build. No mainnet in v1.
**Transaction model (v2.0):** Every WalForm Sui transaction — creator publish/update/close, marketplace publish/list, marketplace clone/purchase, respondent submit, Mode B deploy — is signed and paid by the **user's connected wallet** via dApp Kit's `useSignAndExecuteTransaction`. There is no app-level sponsorship and no `/api/sponsor` route. Enoki is retained only for `registerEnokiWallets` (Google sign-in). Older sections of this PRD that reference sponsored gas describe the v0.9–v1.1 design — see Appendix A entry dated 2026-05-07 for the supersession.
**Storage posture:** To minimise the WAL surface, the **mandatory** base flow uses Sui only — both **form schema** and **encrypted submission bodies** are stored inline in their Sui objects. WAL is **only required for opt-in features**: Mode B Walrus-Site deploy, optional cover/theme images, and `FILE_UPLOAD` attachments. A form with none of those features costs zero WAL end-to-end. See §7.4.
**Distribution modes:** Every form is submittable **by default from `walform.wal.app/f/{form-id}`** (built-in renderer, no extra deploy step). Creators can **optionally** deploy their form as its own **Walrus Site** and attach a **SuiNS** name for a custom URL like `{name}.wal.app`. Both modes share the same Seal whitelist policy.
**Stack:** Vite 7 + React 19 + react-router-dom v7 static SPAs for the builder + Mode B shell, deployed to Walrus Sites; plus a vendored Walrus Sites gateway. `apps/builder` = Vite SPA → static `out/` (hosts landing + creator dashboard + Mode A renderer at `/f?formId=…`). `packages/walform-site` = Vite SPA → static `dist/`, shared shell deployed to Walrus once — per-form Mode B deploys just create a `site::Site` PTB pointing at the shared blob. `packages/core` = shared library consumed by both. `apps/portal` = **Mysten's Walrus Sites portal** (vendored from `MystenLabs/walrus-sites/portal`), the gateway that resolves `{subdomain}.wal.app` requests into Walrus blob fetches — this is infrastructure, not a React app. No server routes, no `/api/sponsor` — every Sui tx is signed and paid by the user's connected wallet via `useExecuteTransaction`. Enoki is used only for zkLogin (Google sign-in). **Migrated off Next.js 2026-06-02.**
**Repo layout:** Turborepo + Bun. `apps/builder`, `apps/renderer`, `apps/portal` (vendored gateway), `apps/contracts` (Move package), and a single shared `packages/core` library.

---

## 0. TL;DR — Decision Summary

The sections below answer the open questions in the scoping conversation. Skim this first; every decision has a full-rationale section further down.

| Open question | Decision | Rationale |
| --- | --- | --- |
| **Hackathon target** | **Sui Overflow 2026**, fully on testnet | Bigger flagship event than Haulout, broader judge audience, testnet posture lets us iterate without real-SUI risk. Haulout remains a secondary track we can re-target with the same codebase. |
| **Builder app framework** | **Vite 7 + React 19 + react-router-dom v7** static SPA → `out/`, deployed to Walrus Sites | No server runtime needed — every tx is user-wallet-signed; Enoki is only for zkLogin. Replaced Next.js 2026-06-02. See Appendix A. |
| **Renderer framework** | **Vite 7 SPA** → `dist/`, static shell deployed to Walrus once, shared across all Mode B forms | Hash routing (`#/f/{formId}`) so static export works without server rewrites. Per-form Mode B is just a `site_object::create` PTB. |
| **Monorepo tooling** | **Turborepo + Bun** | Bun as package manager + runtime (fast installs, native TS). Turbo for task caching across `apps/*` and `packages/*`. |
| **Shared library** | **Single `packages/core`** — shadcn primitives + Zod schemas + Sui/Walrus/Seal/crypto helpers + Tailwind preset all in one package | One import path across all apps. Kept intentionally flat instead of 4 micro-packages to reduce boilerplate and tsconfig/build juggling. |
| **Transaction model (v2.0)** | **Every Sui tx is signed and paid by the user's connected wallet** via `useExecuteTransaction` (wraps dApp Kit's `useSignAndExecuteTransaction`) | Original sponsor design (Enoki app-paid) superseded 2026-05-07. No `/api/sponsor`, no app-level gas payment. Enoki retained only for `registerEnokiWallets` (Google sign-in). |
| **Result visibility model** | **Seal whitelist: creator + submitter only.** No time-locked or public-after-close mode in v1. | Simpler policy, fewer edge cases, covers both "creator reads everything" and "respondent can see their own submission" with a single Move policy. See §7.5, §8. |
| **Max submissions + deadline controls** | Creator sets **max submissions** and **closes at** timestamp at publish time. Both optional (empty = unlimited / no deadline). Enforced in Move on `submit()`. | See §4.5, §8.2. |
| **Template marketplace mechanic** | **Sui Kiosk + TransferPolicy only.** No Sui Payment Kit. | Kiosk is native, decentralized, and already handles royalty-enforced purchase. Sui Payment Kit is a managed-checkout layer we don't need and don't want as an extra centralization point. Free templates use a plain `clone_free` entry fn. See §7.2. |
| **Platform fee on paid templates** | **10% TransferPolicy royalty on every paid-template purchase, routed to the WalForm platform treasury.** Set once at package publish. | We are the `Publisher<FormTemplate>`, so we own the `TransferPolicy<FormTemplate>` and can set a fixed 10% royalty rule that runs on every Kiosk `purchase`. Seller (template creator) still gets the full listed price; buyer pays listed + 10% on top. Free templates bypass the Kiosk path entirely. See §7.2. |
| **AI integration** | **BYOK via Vercel AI SDK v6**, client-side. Providers: **OpenRouter** (default, free model available) or **OpenAI**. Key stored in localStorage (IndexedDB encryption deferred). AI calls go browser → provider direct; no server-side proxy. See §7.3. |
| **Where do encrypted submission bodies live — Sui or Walrus?** | **Inline in the Sui `Submission` object** (not Walrus). Same logic applies to the form schema, which is also inline in the `Form` object. | Base flow costs zero WAL — respondents pay SUI gas via their wallet, creators pay at publish. WAL is opt-in: Mode B Walrus Site deploy, cover images, FILE_UPLOAD attachments. See §7.4 and §9. |
| **Form distribution — built-in or Walrus Site?** | **Two modes, creator's choice at publish.** Default: built-in renderer on `walform.wal.app/f?formId=…` (zero extra steps). Optional: deploy to a Walrus Site for `{name}.wal.app`. | Default covers 90% of use cases with the simplest possible UX. Walrus-Site is the "ultimate decentralization + branded URL" path for creators who want it. See §5.2. |
| **Fully on-chain decentralized?** | **Data / logic / access-control: yes (even on testnet). Gas payment, OAuth identity: no** (Enoki OAuth + user wallet SUI). Progressive decentralization — documented honestly in the pitch. See §7.5. |

---

## 1. Vision & Guiding Principles

### Tagline
*"Build forms that can't be taken down. Own the data. Encrypt by default."*

### Vision
WalForm is the first truly decentralized form builder on Sui. Drag-and-drop UX for creators; mainstream-grade UX for respondents (zkLogin, gasless submit); and every byte of form schema, every submission, every access-control rule lives either as a Walrus blob or a Sui object. No platform can take a form down. No operator can read submissions. Not even us.

### Guiding principles (rank-ordered)

1. **Data sovereignty over convenience.** Every submission is Seal-encrypted client-side before it touches Walrus. The only key custodian is the form owner.
2. **Mainstream UX, not crypto UX.** A respondent should not need to know they're using a blockchain. zkLogin + sponsored gas + no-wallet submission by default.
3. **Progressive decentralization.** Ship with Enoki / Vercel where it speeds delivery; replace centralized pieces one by one post-hackathon. Never compromise on data-layer decentralization.
4. **Respondents pay nothing, ever.** On testnet we (the app) eat gas via Enoki; on mainnet the long-term model is creator-funded `GasReservoir` + app-subsidy mix, but the respondent-facing promise never changes. This mirrors Tally/Typeform UX and is the only model that reaches mainstream scale.
5. **Composable, not closed.** Forms are Sui objects, responses are Walrus blobs, templates are Kiosks. Anything on WalForm can be read, remixed, or extended by another app.

### Non-goals for v1

- Real-time collaboration on form editing (Figma-style multi-cursor). Post-MVP.
- Server-side analytics / BI integrations (Zapier, webhooks). Post-MVP.
- Mobile native app. Web-first for v1.
- On-chain submission indexing via custom indexer. Will use Sui events + RPC for MVP.

---

## 2. Target Submission & Market Context

### Hackathon target

**Sui Overflow 2026** — Mysten Labs' flagship annual hackathon. We submit on Sui testnet, with all infra (Sui, Walrus, Seal, Enoki) on their respective testnet endpoints.

Tracks we're eligible for / targeting:

- **Programmable Storage (Walrus)** — primary fit. Every form schema + every submission blob is on Walrus testnet; the renderer itself is a Walrus Site. Heavy, visible Walrus usage.
- **Cryptography (Seal)** — primary fit. All submissions are Seal-encrypted client-side; the Seal whitelist policy guards read access so only the creator and the original submitter can decrypt.
- **Infra & Tooling** — secondary fit. WalForm is a general-purpose tool: a Sui-native replacement for Tally/Typeform. Gives judges an easy "I'd actually use this" reaction.
- **AI × Data** — secondary fit via AI form generation / response summarization using BYOK client-side AI.

**Secondary target:** **Walrus Haulout Hackathon** — same codebase, separate submission if timing allows. Haulout's "Data Privacy" and "Data Economy" tracks map cleanly onto our existing features.

### Why testnet-only for v1

- Overflow judges test on testnet; mainnet-only projects are harder to evaluate.
- Testnet SUI is free via faucet. Enoki testnet quota is effectively unlimited for demo traffic.
- No real-money blast radius during rapid iteration.
- We can still point judges at live Sui testnet explorer + Walrus testnet to verify all on-chain claims.
- Mainnet migration is a post-hackathon effort with its own economics (creator-funded `GasReservoir`, paid templates priced in real SUI, etc).

### Competitive landscape (explicit)

| Tool | Decentralized frontend | E2E-encrypted submissions | Gasless UX | Template marketplace | Native crypto payments |
| --- | --- | --- | --- | --- | --- |
| Google Forms / Typeform / Tally | No | No | N/A (free) | Yes (Tally/Typeform) | No (Stripe only) |
| BlockSurvey | No (centralized backend) | Yes (PGP) | No | No | No |
| Fillout / Formspree | No | No | N/A | No | No |
| **WalForm** | **Yes (Walrus Site)** | **Yes (Seal)** | **Yes (Enoki sponsor)** | **Yes (Sui Kiosk)** | **Yes (native Sui)** |

No one else has the full stack decentralized + gasless + E2E encrypted + template market. That is the pitch.

---

## 3. Users & Use Cases

### Personas

**Creator (Carla)** — DAO ops lead. Wants to run a sensitive governance survey. Cannot use Google Forms (centralized, readable). Cannot use BlockSurvey (respondents need a PGP key). Needs E2E encryption, token-gated submissions, sponsored gas so member respondents don't need SUI.

**Respondent (Ravi)** — DAO member, not a crypto native. Has a Google account. Wants to submit in two clicks: sign in with Google (zkLogin) → fill form → submit. Should not touch SUI.

**Template creator (Tina)** — Form designer / consultant. Wants to monetize by publishing reusable templates (NPS, employee survey, event RSVP) with royalties on clone.

### Target use cases (MVP)

1. **DAO governance survey** — token-gated, sponsored gas; creator reads all responses, each voter sees only their own (Seal whitelist).
2. **Hackathon submission form** — token-gated to confirmed attendees, file uploads to Walrus; creator (judges) read all, submitters see their own.
3. **Pseudonymous feedback / tip line** — public form, respondents sign in with a fresh zkLogin (throwaway Google account) or any wallet. Submission is tied to that identity but not to the person's real-world name. Creator decrypts all; submitter can still re-read their own entry via the same identity.
4. **Token-gated RSVP** — NFT-holder only, optional SUI payment per RSVP.
5. **Template marketplace** — Tina publishes "Hackathon feedback v2" template at 2 SUI, Carla clones it in one click, 10% royalty routes to Tina on each clone.
6. **AI-assisted form generation** — creator types "make me a NPS survey for a fintech product" → AI SDK v6 + OpenRouter returns schema → loaded into builder canvas.

Note on anonymity: **every submission requires a signed identity** (wallet or zkLogin). There is no `allow_anonymous` mode in v1 — without an identity we can't enforce per-submission rate limits or give submitters a whitelist key to read their own entry back. The closest thing we offer is "sign in with a fresh Google via zkLogin", which is pseudonymous, not anonymous.

### Target use cases (stretch / post-MVP)

7. **Sealed-bid auction form** — submissions encrypted until an unlock timestamp. Requires the time-locked Seal policy deferred to post-MVP.
8. **Anonymous hackathon judging** — judges submit scores under zkLogin; results revealed post-deadline to track leads. Needs reader-allowlist policy deferred to post-MVP.

---

## 4. Feature Specification

Legend: [MVP] must ship for hackathon • [stretch] if time allows • [later] post-MVP

### 4.1 Question blocks

| Block | Status | Notes |
| --- | --- | --- |
| Short answer | MVP | |
| Long answer | MVP | |
| Multiple choice (single) | MVP | |
| Checkboxes (multi) | MVP | |
| Dropdown | MVP | |
| Number | MVP | |
| Email | MVP | |
| Date | MVP | |
| Rating (stars) | MVP | |
| Linear scale | MVP | |
| File upload | MVP | Walrus blob (Quilt for multi-file, see §9) |
| Payment | MVP | Native Sui coin transfer, our differentiator |
| Wallet connect | MVP | Same |
| Multi-select, Phone, URL, Time, Signature | stretch | If week-3 time allows |
| Matrix, Ranking | later | Complex UI, post-MVP |

### 4.2 Layout / embed blocks (all MVP unless noted)

Heading H1/H2/H3, Body text, Divider, Page break, Thank-you page, Image (Walrus), Video (stretch — Walrus shines here but not critical for MVP demo).

### 4.3 Logic & validation

| Feature | Status |
| --- | --- |
| Required / not required | MVP |
| Min/max length, regex, min/max value | MVP |
| Conditional logic (show/hide/skip-to-page) | MVP — JSON rules, client-side eval |
| Hidden fields from URL params | MVP |
| Calculated fields | stretch |

### 4.4 Access control

| Mode | Status | Description |
| --- | --- | --- |
| Public | MVP | Anyone with link; **must still connect a wallet** (any wallet, including zkLogin) — submissions are never anonymous |
| Token-gated | MVP | Must hold specified NFT / coin type |
| Allowlist | MVP | `VecSet<address>` in Move |
| Paid | MVP | Must transfer N SUI (testnet SUI) to form treasury per submit |
| Soulbound / SBT only | stretch | Bonus if it plugs into existing SBTs cheaply |

**Wallet options:** regardless of access mode, the respondent can connect with **Slush, Sui Wallet, any Sui-standard installed wallet, or Enoki zkLogin (Google/Apple)**. Sponsorship applies to all of them — respondents never pay.

**No anonymous mode in v1.** Every submission carries the signer's address. The closest we offer to anonymity is "sign in with a burner Google account via zkLogin", which produces a fresh Sui address unique to that OAuth identity.

### 4.5 Result visibility

**Decision:** single model — **Seal whitelist: creator + submitter only.** No time-locked or public-after-close mode in v1. This makes the Move Seal policy tiny (two branches) and still covers the two real use cases: creator reads everything, respondent sees a receipt of their own answers.

| Mode | Status |
| --- | --- |
| Creator can decrypt all submissions | MVP |
| Submitter can decrypt their own submission (receipt) | MVP |
| Reader allowlist (team access) | later |
| Public after form closes | later |
| Time-locked reveal | later (considered for mainnet when the sealed-bid use case is worth the complexity) |

### 4.5.1 Publish-time limits

At publish, creator sets the following optional caps (stored in `FormSettings`). Empty / unset = unlimited / no deadline.

| Control | Type | Default | Enforcement |
| --- | --- | --- | --- |
| Max submissions | `u64` (0 = unlimited) | 0 | Move `assert!(stats.submission_count < settings.max_submissions)` in `submit()` |
| Closes at | `u64` ms timestamp (0 = never) | 0 | Move `assert!(clock.ms() < settings.closes_at_ms)` in `submit()` |

Both are part of the initial publish tx and can be updated post-publish by the `FormOwnerCap` holder (e.g. extend deadline, raise cap).

### 4.6 Sui-native / differentiating features

| Feature | Status | Why it matters |
| --- | --- | --- |
| App-level Enoki sponsorship for all submissions | MVP | Testnet demo: zero friction, respondents submit free with any wallet or zkLogin |
| zkLogin via Enoki (Google/Apple) | MVP | Required for mainstream respondent UX; OAuth identity layer |
| On-chain payment block (testnet SUI) | MVP | Native Sui, Tally can't do this |
| On-chain proof link (Sui testnet explorer) | MVP | Trivial, huge trust signal |
| Walrus Site deploy + SuiNS custom URL | MVP (optional per form) | For creators who want branded `{name}.wal.app` URLs |
| NFT submission receipt | stretch | Nice for events/RSVPs |

### 4.7 Template marketplace (Kiosk-backed)

| Feature | Status |
| --- | --- |
| Publish form as template (free) | MVP |
| Publish form as paid template (X SUI) | MVP |
| Clone template → new Form | MVP |
| Creator royalty on clone (e.g. 10%) | MVP (TransferPolicy rule) |
| Template gallery / browse UI | MVP |
| Template rating / reviews | later |
| Template versioning | later |

### 4.8 AI (BYOK, client-side, Vercel AI SDK v6)

**Stack:** Vercel **AI SDK v6** (`ai` + `@ai-sdk/openai` + `@ai-sdk/openai-compatible`) with two provider presets:

- **OpenRouter (default, recommended)** — single API key unlocks Claude, GPT, Gemini, open-source models. Great for BYOK since the user can pick whichever provider they trust.
- **OpenAI direct** — if the user has an OpenAI key and prefers that path.

All calls go **browser → provider directly** (no server-side proxy). BYOK stays BYOK.

| Feature | Status |
| --- | --- |
| Paste + store key (encrypted in IndexedDB) | MVP |
| Pick provider (OpenRouter default, OpenAI alt) | MVP |
| "Generate form from prompt" (structured output via AI SDK `generateObject` + our Zod schema) | MVP |
| "Summarize responses" (post-decrypt, creator-side, `streamText`) | MVP |

---

## 5. Tech Stack Decisions

### 5.1 One app + one shared static shell + one vendored gateway

> **Note (2026-06-02): This section describes the original Next.js architecture. Both apps have been migrated to Vite 7 SPAs — see Appendix A 2026-06-02. The shared-shell architecture described below remains accurate; only the bundler and hosting have changed.**

**Decision (v1.0, supersedes v0.x):** one builder app + one shared Mode B shell. Earlier drafts had `apps/renderer` as a separate Next.js `output: 'export'` app rebuilt per form and pushed to Walrus per form. That was dropped on 2026-04-26 — N forms generated N copies of identical JS, wasted WAL, and added a build pipeline for nothing. The replacement is a single `packages/walform-site/` shell (now Vite 7 SPA), built once, pushed to Walrus once, reused by every Mode B form via hash routing.

- **Builder app** (`apps/builder`) — **standard Next.js build**, full Node server runtime on Vercel. Holds `/api/sponsor` (Enoki secret), the creator dashboard, authoring canvas, Mode A renderer at `/f/[id]`, landing + public template gallery, marketplace, and the deploy-to-Walrus button. The same `<FormSubmissionView>` rendered at `/f/[id]` is the component the static shell wraps for Mode B.
- **walform-site** (`packages/walform-site`, future) — vite/next static export. Bundles dApp Kit + Seal + sponsor client + `<FormSubmissionView>`. Reads the form id from URL hash (`#/f/{id}`), fetches the `Form` Sui object at runtime, lets respondents submit via a cross-origin POST to `walform.wal.app/api/sponsor`. Pushed to Walrus ONCE; per-form Mode B deploy is just a `site_object::create` PTB pointing at the shared blob, optionally with a SuiNS attach.
- **Portal** (`apps/portal`) — vendored from [`MystenLabs/walrus-sites/portal`](https://github.com/MystenLabs/walrus-sites/tree/main/portal). **Local-dev only** in v1: lets us hit `{base36}.localhost:8080` against testnet without going through Mysten's public portal. Production points SuiNS at the public `wal.app` portal directly.

**Why one shared shell instead of per-form static export.**

1. **WAL cost stays flat.** Per-form export = N × (Next bundle + framework + dApp Kit + Seal SDK ≈ 350 KB) on Walrus. Shared shell = 1 × that, attached to N Forms via SuiNS. Storage cost decoupled from form count.
2. **Faster Mode B deploys.** No client-side Vite/esbuild pass to bundle JS per form. The shell is pre-built; deploy is a single PTB.
3. **Updates land everywhere.** Push a new shell blob, point all Walrus Sites at it. Per-form exports would each need re-pushing.
4. **The renderer is dynamic anyway.** Even a per-form export had to fetch the Form from Sui at runtime (form data lives on chain, not in the bundle). So per-form bundling never bought us much.

**How we handle dynamic form IDs under static export:**

The shell is a single static entry. URLs use either:
- `{name}.wal.app/#/f/{form-id}` — shared shell, hash routes to the form
- `{form-id-base36}.wal.app/` — same shell, but SuiNS already encodes the form id; the shell reads it from `document.baseURI`

Client code parses `window.location.hash` (or extracts the base36-encoded form id from the hostname) at runtime and fetches the `Form` Sui object. Schema, settings, and stats come back inline as part of the object — no second network call.

### 5.2 Hosting layout & form-delivery modes

Every form is distributable in **two independent modes** — they coexist, creator picks per form at publish time.

**Mode A (default): Built-in on the builder portal**
- URL: `walform.wal.app/f/{form-id}`
- The builder Next.js app has a route that renders the form directly. `<FormSubmissionView>` (`packages/core/src/forms/components/submit/`) fetches the Form via Sui RPC, renders `<FormPreview>`, encrypts via Seal, sponsors via `/api/sponsor`.
- **Zero extra deploy step.** As soon as the form's on-chain `create_form` tx confirms, the URL works.
- Doubles as the in-builder preview before a creator decides to deploy Mode B.

**Mode B (optional): Walrus Site for the form, shared shell**
- URL: `{form-id-base36}.wal.app` or `{name}.wal.app` (with SuiNS)
- Creator opts in at publish: client builds a `site_object::create` PTB pointing at the pre-existing `walform-site` shell blob, sets `site_object_id` on the Form, optionally attaches a SuiNS name.
- The Mysten public `wal.app` portal serves the shared shell when the subdomain resolves. No per-form bundle, no per-form WAL spend.
- Strongest decentralization story: form's HTML/JS comes from Walrus, schema comes from Sui, encryption keys come from Seal — no Vercel in the request path.

Both modes use the **same Move contracts, same Seal policy, same `/api/sponsor` endpoint**. The only difference is who serves the HTML/JS shell.

| Piece | Framework / source | Output | Host | URL |
| --- | --- | --- | --- | --- |
| Builder (dashboard + landing + template gallery + Mode A renderer + Marketplace + `/api/sponsor`) | Next.js 15 | Full SSR | Vercel | `walform.wal.app` |
| Mode B static shell (`packages/walform-site`, shared across all forms) | Vite or Next `output: 'export'` | One static bundle pushed to Walrus once | Walrus testnet, served via Mysten's `wal.app` portal | `{form-id-base36}.wal.app` or `{name}.wal.app` |
| Portal (`apps/portal`) | Vendored from `MystenLabs/walrus-sites/portal` | Cloudflare Worker | localhost:8080 | dev only |
| Smart contracts | Move 2024 | N/A | Sui testnet | Package ID in `apps/contracts/deployed.json` |

### 5.3 Stack summary

| Layer | Choice | Notes |
| --- | --- | --- |
| Package manager / runtime | **Bun** | Fast installs, native TS, one-binary dev tool |
| Monorepo tooling | **Turborepo** | Task caching + parallelism across `apps/*` and `packages/*` |
| Builder (`apps/builder`) | **Next.js 15 App Router** + React 19 + TS, standard build | API routes in `app/api/*`. Sponsor endpoint, allowlist validator, admin fallback. Landing + template gallery + Marketplace + Mode A `/f/[id]` all live here. Vercel. |
| Mode B shell (`packages/walform-site`, future) | Vite or Next `output: 'export'` | One static bundle pushed to Walrus once. Hash routing for dynamic form IDs. Reuses `<FormSubmissionView>` from `packages/core`. |
| Portal (`apps/portal`) | **Vendored from `MystenLabs/walrus-sites/portal`** | Cloudflare Worker | Local dev only — `{base36}.localhost:8080` resolves testnet Walrus blobs. Production uses the public `wal.app` portal. |
| Contracts (`apps/contracts`) | Move 2024 | Sui testnet | Form, submission (inline ciphertext), template (+ Kiosk + 10% royalty + multi-buyer `clone_paid` listings), allowlist, payment, seal policies (incl. v2 schema decryption). Deployed package ID in `apps/contracts/deployed.json`. |
| Shared library (`packages/core`) | shadcn/ui primitives + `<FormPreview>` + `<FormSubmissionView>` + Zod schemas + Sui/Walrus/Seal helpers + sponsor transport + Tailwind preset | One package, consumed by builder + the future Mode B shell. |
| Routing (Mode B shell) | **Hash routing** (`window.location.hash`) or hostname-derived form id | Walrus Sites has no server rewrites; hash is the safest path. |
| State | Zustand + TanStack Query | |
| Drag-drop | dnd-kit | |
| Forms / validation | React Hook Form + Zod | |
| Charts | Recharts | |
| Wallet / dApp | `@mysten/dapp-kit` + `@mysten/sui` | Auto-detects Slush, Sui Wallet, and any installed Sui-standard wallet |
| Sponsored tx + zkLogin | `@mysten/enoki` — server SDK in Next.js API route, `registerEnokiWallets` on client | `ENOKI_SECRET_KEY` only in Next.js server runtime |
| Walrus SDK | `@mysten/walrus` + publisher HTTP fallback | Walrus **testnet** publishers/aggregators. Used only for form schema, cover/theme assets, file attachments — **not** for submission bodies (see §7.4) |
| Seal SDK | `@mysten/seal` | Seal **testnet** key servers; whitelist policy (see §8) |
| AI | **Vercel AI SDK v6** (`ai`, `@ai-sdk/openai`, `@ai-sdk/openai-compatible` for OpenRouter) | BYOK, IndexedDB for key storage, browser → provider direct |
| Smart contracts | Move 2024 | `sui move build` + `sui client publish --gas-budget` against testnet |
| Contract testing | `sui move test` + TS integration tests against `sui-test-validator` | |
| Frontend testing | Vitest + React Testing Library + Playwright (smoke) | |
| Hosting (builder) | Vercel | `walform.wal.app` — dashboard, landing, gallery, `/f/{form-id}`, `/api/sponsor` |
| Hosting (Mode B shell) | Walrus testnet via the public `wal.app` portal | One static blob shared across all Mode B forms; per-form Mode B deploy is a `site_object::create` PTB pointing at the blob |
| Hosting (portal gateway) | `apps/portal` Cloudflare Worker, local dev only | Production uses public `wal.app` portal directly |
| CORS | `/api/sponsor` allow-lists `*.wal.app` (Mode B) + Vercel origin (Mode A) + localhost ports | See §6 |

### 5.4 Turborepo / Bun layout

```
walform/
├── apps/
│   ├── builder/              # Vite 7 SPA → static out/, deployed to Walrus Sites
│   │   ├── src/
│   │   │   ├── main.tsx      #   SPA entry
│   │   │   ├── router.tsx    #   react-router-dom v7 flat routes
│   │   │   └── routes/       #   Home, Forms, FormEdit, FormPreview, FormResults,
│   │   │                     #   PublicSubmit (/f?formId=…), Admin, NotFound
│   │   ├── index.html
│   │   └── vite.config.ts
│   ├── portal/               # VENDORED + FLATTENED from
│   │   │                     # MystenLabs/walrus-sites/portal. Local dev only —
│   │   │                     # production uses the public wal.app portal.
│   │   │                     # Resolves {base36}.localhost:8080 → Walrus testnet.
│   │   │                     # Cloudflare Worker flavor.
│   │   ├── src/              # Worker entry points (from upstream worker/src/)
│   │   ├── lib/              # Shared library code (from upstream common/lib/)
│   │   │   ├── src/          #   core lib
│   │   │   └── tests/        #   vitest tests
│   │   ├── html_templates/   # 404 + hash-mismatch HTML
│   │   ├── static/           # Worker's public assets
│   │   ├── webpack.config.*.js, vite.config.mts
│   │   ├── tsconfig.json, package.json
│   │   ├── UPSTREAM.md       # Upstream commit SHA, re-sync instructions
│   │   └── wrangler.toml
│   └── contracts/            # Move 2024 package — Sui testnet + mainnet
│       ├── sources/*.move    #   form, submission, allowlist, template,
│       │                     #   seal_policies, payment, events, voting
│       ├── tests/*.move      #   47 unit tests
│       ├── Move.toml
│       └── deployed.json     # Published package IDs
├── packages/
│   ├── core/                 # SHARED library — consumed by builder + walform-site
│   │   └── src/
│   │       ├── ui/           #   shadcn primitives + fonts
│   │       ├── forms/        #   <FormPreview>, <FormSubmissionView>, hooks,
│   │       │                 #   IDB drafts, Marketplace browse/buy, publish dialog
│   │       ├── schema/       #   Zod types (FormSchema, fields)
│   │       ├── sui/          #   providers, useExecuteTransaction, wallet UI, tx
│   │       │                 #   builders, codegen bindings
│   │       ├── crypto/       #   Seal client + identity + session + sub/schema
│   │       └── tailwind.ts   #   Tailwind v4 config
│   ├── walform-site/         # Mode B static shell — Vite 7 SPA → dist/
│   │                         # hash-routed #/f/{formId}, mirrored into builder
│   ├── build-config/         # nextPublicDefine Vite define helper
│   ├── eslint-config/        # Shared ESLint
│   ├── prettier-config/      # Shared Prettier
│   └── tsconfig/             # Shared TS config
├── docs/
│   └── PRD.md
├── package.json              # Bun workspaces root
├── turbo.json
└── bun.lockb
```

---

## 6. Architecture Overview

> **Note (2026-05-07): The diagram and request flow below describe the original sponsor-based architecture with `/api/sponsor`. The current v2.0 architecture replaces all of this with user-wallet-signed transactions via `useExecuteTransaction` — see §7.1 for the superseding design and Appendix A for the decision log. The data flows (Sui, Walrus, Seal) remain accurate; only the transaction transport changed.**

```
+---------------------------------------------------------------------+
|                         CREATOR (Carla)                             |
|   Browser -> https://walform.wal.app  (Next.js on Vercel, testnet)      |
|                                                                     |
|   apps/builder:                                                     |
|   - Drag-drop form editor (client components)                       |
|   - Template gallery / browse & clone                               |
|   - Dashboard: owned forms, submission stats                        |
|   - Results viewer (Seal decrypt client-side, charts)               |
|   - AI assistant (BYOK, browser -> provider direct)                 |
|                                                                     |
|   Client state: Zustand + IndexedDB (drafts, AI keys,               |
|                 cached decrypted responses)                         |
+----+-----------+------------------+------------------+--------------+
     |           |                  |                  |
     | signs tx  | uploads blob     | reads chain      |
     |           |                  |                  |
     |           |                  |        +---------v-----------+
     |           |                  |        | Next.js API routes  |
     |           |                  |        | (server runtime)    |
     |           |                  |        |                     |
     |           |                  |        |  /api/sponsor       |
     |           |                  |        |    - holds          |
     |           |                  |        |      ENOKI_SECRET   |
     |           |                  |        |    - validates tx   |
     |           |                  |        |      (submit() or   |
     |           |                  |        |      clone_template)|
     |           |                  |        |    - rate-limits    |
     |           |                  |        |    - calls Enoki ->  |
     |           |                  |        |      signed gas tx  |
     |           |                  |        |  /api/ai-proxy      |
     |           |                  |        |    (stretch only)   |
     |           |                  |        +---------+-----------+
     |           |                  |                  |
     v           v                  v                  v
+------------+  +-----------------+  +--------------+  +-------------+
| SUI TESTNET|  | WALRUS TESTNET  |  | Sui RPC      |  | ENOKI       |
|            |  |                 |  | (reads)      |  | (managed)   |
| Move:      |  | Blobs (creator- |  +--------------+  |             |
| - form     |  | paid at publish |                    | zkLogin +   |
|   + INLINE |  | or app WAL      |                    | sponsored-  |
|   schema   |  | pool on testnet;|                    | tx signing  |
| - owner_cap|  | ALL opt-in)     |                    |             |
| - allowlist|  | - cover image   |                    | App-level   |
| - submission| | - file uploads  |                    | secret      |
|   + INLINE |  |                 |                    | lives on    |
|   cipher   |  |                 |                    |             |
|   text     |  |                 |                    |             |
| - payment  |  | Walrus Sites    |                    | our Next.js |
| - template |  | (Mode B only):  |                    | server      |
|   (+Kiosk) |  | - renderer      |                    | only.       |
| - seal_*   |  |   bundle at     |                    |             |
|            |  |   {id}.wal.app  |                    |             |
| (no gas_   |  |                 |                    |             |
|  reservoir |  | NOT used for    |                    |             |
|  in v1)    |  | submission body |                    |             |
|            |  | (see §7.4)      |                    |             |
+--------+---+  +-----------------+                    +-------------+
         |
         | Seal policy check
         v
+----------------------------+
|      SEAL KEY SERVERS      |
|   (testnet, t-of-n)        |
|  - seal_approve_read_results|
|  - seal_approve_submit     |
+----------------------------+
         ^
         |
+--------+-------------------+
|       RESPONDENT (Ravi)    |
|                            |
|  Two possible entry URLs:  |
|   Mode A: walform.wal.app/f/ID |
|    (served by builder      |
|     Next.js on Vercel)     |
|   Mode B: {id}.wal.app     |
|    (Next.js static export  |
|     on a Walrus Site)      |
|  Both render the same      |
|  <FormRenderer> from       |
|  packages/core.              |
|                            |
|  1. Load form page         |
|  2. Read form id from URL  |
|  3. Fetch Form object      |
|     (schema is inline)     |
|  4. Connect wallet -- any  |
|     of: Slush, Sui Wallet, |
|     Enoki zkLogin, ...     |
|  5. Fill form              |
|  6. Seal.encrypt(responses)|
|     -> ciphertext bytes    |
|  7. (Optional) upload      |
|     FILE_UPLOAD attachments|
|     to Walrus              |
|  8. Build submit() tx with |
|     encrypted_body INLINE  |
|     + file_blob_ids        |
|  9. POST tx ->             |
|     walform.wal.app/api/sponsor|
| 10. Receive signed-gas tx  |
| 11. Sign sender half       |
|     (one-tap via wallet    |
|     or zkLogin)            |
| 12. Broadcast to Sui       |
|     testnet                |
|                            |
|  Respondent pays: $0 SUI,  |
|  $0 WAL (unless FILE_UPLOAD|
|  — file bytes go via app   |
|  WAL pool on testnet)      |
|  We pay: via Enoki quota   |
+----------------------------+
```

### Request flow: gasless submission end-to-end

```
Renderer (browser)                 Builder /api/sponsor (Next.js server)        Enoki API
  |                                        |                                       |
  | POST /api/sponsor                      |                                       |
  | body: { tx_kind: "submit",             |                                       |
  |         payload_bcs, sender, ...}      |                                       |
  |--------------------------------------->|                                       |
  |                                        | 1. Validate tx targets allowed Move  |
  |                                        |    call (form::submit or template::  |
  |                                        |    clone_template) — reject anything |
  |                                        |    else.                              |
  |                                        | 2. Per-sender rate-limit check       |
  |                                        |    (Redis / Vercel KV).               |
  |                                        | 3. Call Enoki createSponsoredTx      |
  |                                        |--------------------------------------->|
  |                                        |                                       | signs gas
  |                                        |<---------------------------------------|
  |                                        | 4. Return { bytes, digest }          |
  |<---------------------------------------|                                       |
  | 5. Sign sender portion (zkLogin)       |                                       |
  | 6. Call Enoki executeSponsoredTx       |                                       |
  |    directly with sender signature------------------------------------------->  |
  |                                                                               | broadcast
  |<------------------------------------------------------------------------------ |
  | 7. Got tx digest, show success UI                                              |
```

### Component responsibilities

| Component | Owns | Does not own |
| --- | --- | --- |
| **Builder app UI (client)** | Form authoring UX, template browsing, result decryption UI, AI calls, drafts | Enoki secret. Plaintext submissions. Permanent server-side state. |
| **Builder `/api/sponsor` (server)** | Enoki secret, tx-shape validation, sponsor rate limits | Form data, submission plaintext, creator auth tokens (beyond session) |
| **Renderer app** | Form display, validation, encrypt-and-submit flow, wallet/zkLogin UI | Any persistent respondent data (draft auto-save is localStorage only) |
| **Move contracts** | Form objects, ownership caps, allowlists, submissions, Seal policies, template kiosk | Encrypted submission contents (only blob IDs). Gas-reservoir accounting is **deferred** for v1. |
| **Walrus (testnet)** | Schema blobs, encrypted submission blobs, file attachments, renderer Walrus-Site bundle | Access control (Sui + Seal handle that) |
| **Seal (testnet)** | Key-share custody, policy enforcement at decrypt | Storage |
| **Enoki (managed)** | Sponsored-tx signing, zkLogin issuance, rate limiting at provider level | Form data, ownership |

### Why `/api/sponsor` is minimal-risk server code

The only server code we ship is this single endpoint. It:

- Holds exactly one secret (the Enoki app key).
- Has no database of its own (rate-limit counters live in Vercel KV or Upstash Redis).
- Persists no user data.
- Is stateless across requests.
- Can be reimplemented in ~100 LOC of any runtime, so the lock-in is near zero.

If `/api/sponsor` goes down, we can swap in a standalone sponsor service (or let respondents opt into paying their own gas) without touching contracts or the renderer. The sponsor is a replaceable detail, not a core dependency.

---

## 7. Key Design Decisions (Deep Dives)

### 7.1 Transaction model — user wallet pays every WalForm tx (v2.0)

**Decision (2026-05-07, supersedes v0.9):** every WalForm Sui transaction is signed and paid by the **user's connected wallet** via dApp Kit's `useSignAndExecuteTransaction`. There is no app-level sponsorship, no `/api/sponsor` route, no admin keypair fallback. The single shared entry point is the `useExecuteTransaction` hook (`packages/core/src/sui/use-execute-transaction.ts`), which wraps `useSignAndExecuteTransaction` with a pinned `chain: 'sui:${network}'`. See Appendix A 2026-05-07 for the rationale.

The original sponsor design (v0.9 → v1.1) is preserved below for historical context but **no longer reflects shipping behaviour**.

---

#### Original (superseded) — Sponsor model — Enoki fully sponsors, any wallet works

**Decision:** Enoki sponsors **every** submission at the **app level**. Creators deposit nothing. Respondents connect with any wallet of their choice (Slush, Sui Wallet, other installed Sui-standard wallets, or Enoki zkLogin for Google/Apple/Twitch) and still have their gas paid by us.

#### Flow summary

1. Respondent connects a wallet via `@mysten/dapp-kit`'s `ConnectButton`. dApp Kit auto-detects all installed Sui wallets (Slush, Sui Wallet, etc.) plus lists Enoki zkLogin providers via `registerEnokiWallets`.
2. Respondent fills the form. Client encrypts via Seal, uploads blob to Walrus, builds the `form::submit(...)` tx.
3. Client POSTs the tx payload to `walform.wal.app/api/sponsor`.
4. Server (a) validates the Move call is in our allowlist of sponsorable entry functions (`form::submit`, `template::clone_template`), (b) rate-limits per sender, (c) calls Enoki `createSponsoredTransaction` with `ENOKI_SECRET_KEY`, (d) returns signed-gas bytes.
5. Client has the connected wallet sign the sender half and submits through Enoki's execute endpoint.

The respondent **never pays gas**, regardless of which wallet type they chose. That is the whole point.

#### Why no creator-funded reservoir in v1

- Testnet SUI is free to us (faucet). Enoki app-level quota handles all demo traffic.
- A reservoir step inserts an extra "please fund your form with SUI before publishing" moment that new creators don't want to do. On testnet, that friction is gratuitous.
- On **mainnet**, creators absolutely need to pay (Enoki dollars add up at scale). That's when `GasReservoir` ships. For the Overflow 2026 hackathon, it does not.

The Move module `gas_reservoir.move` lives in the repo as a **post-MVP sketch** — written but not required by any MVP code path.

#### The "do we need Enoki if everything is client-side?" question — answered

**Short answer: yes, they're orthogonal concerns.**

| Concern | Solved by |
| --- | --- |
| Storing form data / responses without a data server | Client-side IndexedDB for drafts + Walrus blobs for persistence. Not solved by Enoki. |
| Running AI inference without a server | Vercel AI SDK v6 + BYOK in browser. Not solved by Enoki. |
| Encrypting responses | Seal SDK, client-side. Not solved by Enoki. |
| Paying gas so respondents without SUI can submit an on-chain tx | Sponsored tx via Enoki (through our `/api/sponsor` server route). |

We do run exactly one server-side route — `/api/sponsor` — because the Enoki secret cannot ship in a public bundle. Every other piece of server-shaped functionality (AI, data) stays in the browser.

#### How we keep the escape hatch

Even though the sponsor layer is "just one Next.js route," we wrap it behind a small interface so MVP-era decisions don't ossify:

```ts
interface SponsorProvider {
  sponsor(tx: TransactionBlock, sender: string): Promise<SignedTransaction>;
}

// MVP:
class EnokiSponsor implements SponsorProvider {
  /* uses @mysten/enoki server SDK with ENOKI_SECRET_KEY */
}

// post-hackathon variants that drop in without touching contracts:
class SelfHostedSponsor implements SponsorProvider { /* our own hot-wallet service */ }
class ReservoirBackedSponsor implements SponsorProvider { /* creator's GasReservoir on mainnet */ }
class NullSponsor implements SponsorProvider { /* respondent pays own gas — opt-in mode */ }
```

Switching providers is a one-line config change per form.

#### What we say in the pitch

> "WalForm's data layer is fully decentralized — schema, submissions, access control are all on Sui and Walrus. For the testnet demo, Enoki pays gas for every submission at the app level, so respondents connect with any wallet (or just a Google account via zkLogin) and never touch a gas dialog. On mainnet we migrate to creator-funded gas reservoirs — the contracts are already designed for that swap."

This is honest, demo-able, and matches what every respected Sui project (GiveRep, PIVY, Coindrip) actually does. Judges reward this framing.

---

### 7.2 Template marketplace (Kiosk + TransferPolicy only)

**Decision:** Use **Sui Kiosk** as the marketplace substrate — nothing else. Each template is a shared `FormTemplate` object listed in the creator's Kiosk. The platform owns the single `TransferPolicy<FormTemplate>` for the whole marketplace, carrying one `royalty_rule` set to **10% (1000 bps)** that routes to the WalForm platform treasury.

Explicitly **not** using:
- Sui Payment Kit — adds a managed-checkout layer we don't need and that would be another centralization point outside the Kiosk primitive. Every purchase can be triggered by a direct `kiosk::purchase` PTB from our own dapp-kit modal.
- Any off-chain escrow / aggregator — Kiosk + TransferPolicy already handle listing, purchase, and royalty enforcement without one.

#### Why Kiosk

Kiosk is Sui's native primitive for onchain commerce. It gives us for free:
- Listing, delisting, price updates.
- `TransferPolicy` — enforces the platform fee at the protocol level. No custom escrow logic.
- Discoverability — any Sui NFT marketplace already understands Kiosk objects.
- **Decentralized by default.** No managed backend, no third-party checkout to depend on.

#### Platform fee — how the 10% works

Because WalForm is the `Publisher<FormTemplate>` (we defined and published the type in our Move package), we own the `TransferPolicy<FormTemplate>`. That policy has **one pre-configured royalty rule** installed at deploy time:

- **Rate:** 10% (1000 bps) of the listed price.
- **Min fee floor:** configurable (e.g. 0.05 SUI) so tiny sales still yield something sensible.
- **Destination:** a platform treasury address held in a shared `PlatformTreasury` object. Withdrawable only by a `PlatformAdminCap`.
- **Scope:** every `kiosk::purchase<FormTemplate>` is gated by this policy. There is no alternative path to transfer a `FormTemplate` without paying the fee.

**Money flow on a paid template sale:**

```
Buyer pays:  listed_price + 10% = listed_price × 1.1
  ├─ listed_price  -> seller's Kiosk balance (template creator)
  └─ 10%           -> PlatformTreasury (via royalty_rule)
```

Free templates skip the Kiosk `purchase` path entirely and use a direct `template::clone_free` entry fn — no fee, no TransferPolicy check.

**Why a single global policy (not per-template):**
- One `TransferPolicy` covers every `FormTemplate` ever minted. No setup burden on creators.
- Creators list a template, set a price — the fee is enforced automatically by the type.
- We don't need per-template policy objects, per-template `TransferPolicyCap`s, or any creator-side policy management.

#### Template lifecycle (sketch)

```move
// template.move

// Platform-wide constants, set once at deployment
const PLATFORM_ROYALTY_BPS: u16 = 1000;        // 10%
const PLATFORM_MIN_ROYALTY_MIST: u64 = 50_000_000; // 0.05 SUI floor

public struct FormTemplate has key, store {
    id: UID,
    schema: vector<u8>,            // Inline schema JSON (same 100 KB cap as Form.schema)
    preview_blob_id: Option<vector<u8>>,  // Optional Walrus blob for preview image
    creator: address,
    title: String,
    description: String,
    category: u8,                 // 0=survey, 1=rsvp, 2=feedback, 3=dao-gov, ...
    created_at_ms: u64,
    clone_count: u64,
    tags: vector<String>,
}

public struct PlatformTreasury has key {
    id: UID,
    balance: Balance<SUI>,
}

public struct PlatformAdminCap has key, store {
    id: UID,
}

// One-time package initialization. Runs automatically via Move's `init` entry.
fun init(otw: TEMPLATE, ctx: &mut TxContext) {
    // Claim the Publisher for FormTemplate (proves we defined this type)
    let publisher = package::claim(otw, ctx);

    // Create the single, global TransferPolicy for FormTemplate
    let (mut policy, policy_cap) = transfer_policy::new<FormTemplate>(&publisher, ctx);

    // Install the 10% platform royalty rule — runs on every kiosk::purchase
    royalty_rule::add(
        &mut policy,
        &policy_cap,
        PLATFORM_ROYALTY_BPS,
        PLATFORM_MIN_ROYALTY_MIST,
    );

    // Share the policy so every Kiosk can use it, burn/keep the cap
    transfer::public_share_object(policy);
    transfer::public_transfer(policy_cap, tx_context::sender(ctx));

    // Bootstrap the platform treasury and admin cap
    let treasury = PlatformTreasury { id: object::new(ctx), balance: balance::zero() };
    transfer::share_object(treasury);
    let admin = PlatformAdminCap { id: object::new(ctx) };
    transfer::public_transfer(admin, tx_context::sender(ctx));

    transfer::public_transfer(publisher, tx_context::sender(ctx));
}

// Creator creates a template from an existing form and lists it at price X
public fun publish_template(
    form: &Form,
    owner_cap: &FormOwnerCap,
    title: String,
    description: String,
    category: u8,
    preview_blob_id: vector<u8>,
    kiosk: &mut Kiosk,
    kiosk_cap: &KioskOwnerCap,
    price_mist: u64,              // 0 = free (uses clone_free instead of Kiosk)
    ctx: &mut TxContext,
) { /* mint FormTemplate, kiosk::place + kiosk::list at price_mist */ }

// Buyer purchases a paid template from seller's Kiosk
// Enforces the 10% platform royalty via policy.
public fun purchase_template(
    template_id: address,
    seller_kiosk: &mut Kiosk,
    buyer_kiosk: &mut Kiosk,
    buyer_kiosk_cap: &KioskOwnerCap,
    policy: &TransferPolicy<FormTemplate>,
    treasury: &mut PlatformTreasury,
    payment: Coin<SUI>,           // must be >= listed_price + royalty
    ctx: &mut TxContext,
): (Form, FormOwnerCap) {
    // 1. kiosk::purchase<FormTemplate>(seller_kiosk, template_id, payment_for_listed_price)
    //    -> (template, transfer_request)
    // 2. royalty_rule::pay(policy, &mut transfer_request, royalty_coin)
    //    -> pays 10% into PlatformTreasury.balance via coin::join
    // 3. transfer_policy::confirm_request(policy, transfer_request)
    //    -> unlocks the template transfer
    // 4. Place template into buyer_kiosk
    // 5. Mint a new Form + FormOwnerCap with schema bytes copied from template
    // 6. Increment template.clone_count
    // 7. Return (form, form_owner_cap) to the buyer
}

// Free templates bypass Kiosk + policy entirely
public fun clone_free(
    template_id: address,
    seller_kiosk: &Kiosk,
    ctx: &mut TxContext,
): (Form, FormOwnerCap) { /* copy template.schema bytes, mint Form + cap, bump clone_count */ }

// Platform admin withdraws accumulated royalties
public fun withdraw_platform(
    _: &PlatformAdminCap,
    treasury: &mut PlatformTreasury,
    amount: u64,
    ctx: &mut TxContext,
): Coin<SUI> { /* balance::split */ }
```

#### UX

```
Template Gallery
+------------------------------------------------------------+
| [Search]     [Category: Survey v]     [Sort: Popular v]    |
+------------------------------------------------------------+
| +-----------+  +-----------+  +-----------+                |
| |  preview  |  |  preview  |  |  preview  |                |
| |   chart   |  |   edit    |  |   event   |                |
| | NPS v2    |  | DAO Vote  |  | Event RSVP|                |
| | 2 SUI     |  | Free      |  | 0.5 SUI   |                |
| | by @tina  |  | by @carol |  | by @dao   |                |
| | 142 clones|  | 89 clones |  | 203 clones|                |
| | [Preview] |  | [Preview] |  | [Preview] |                |
| | [Clone >] |  | [Clone >] |  | [Clone >] |                |
| +-----------+  +-----------+  +-----------+                |
+------------------------------------------------------------+
```

Clone flow: one wallet tx. Respondent-style zkLogin works here too — buyers don't need a Sui Wallet browser extension to clone.

#### Where templates are indexed

For MVP we **do not** build a backend indexer. The gallery queries Sui for all `FormTemplate` objects via RPC `sui_getOwnedObjects` + type filter (objects inside Kiosks can be queried by the dynamic-field pattern). This is slower but fully decentralized.

Post-MVP: a thin indexer (subscribe to `TemplatePublished` events, mirror to Postgres, GraphQL on top) for fast gallery queries.

---

### 7.3 AI integration (BYOK + Vercel AI SDK v6 + OpenRouter/OpenAI, client-side)

**Decision:** Users supply their own API key. Calls are made from the browser via **Vercel AI SDK v6**, pointing at either **OpenRouter** (default) or **OpenAI** (alternative). Our Next.js server is *not* in the AI call path — data and keys never touch our infra.

#### Why this stack

- **Vercel AI SDK v6** gives us `generateObject` (structured output against a Zod schema — perfect for "generate a form from prompt") and `streamText` (streaming summaries of responses) with a clean, provider-agnostic surface.
- **OpenRouter** as the default provider means a single BYOK unlocks Claude, GPT, Gemini, and open models — users pick whichever they trust for their data. Reduces vendor-lock worry.
- **OpenAI direct** is offered as an alternative because many developers already have an OpenAI key in hand.
- Both providers support browser-side usage; AI SDK v6 handles the relevant CORS/headers.

#### Storage & security of the user's API key

1. User pastes key into Settings dialog, picks provider (OpenRouter or OpenAI).
2. Key is AES-GCM encrypted with a key derived from a wallet-signed personal message (PBKDF2 → AES key). An attacker with filesystem access alone cannot decrypt; they also need the user's wallet to sign the unlock message.
3. Encrypted blob stored in IndexedDB.
4. On each AI call, we prompt wallet for the unlock signature (cached per session) → derive AES key → decrypt → pass into the AI SDK provider constructor.
5. Key never leaves the device. Never touches any server we run.

#### AI use cases (MVP)

**(a) Generate form from prompt** — creator-side, via `generateObject`
```ts
const { object: schema } = await generateObject({
  model: openrouter("anthropic/claude-sonnet-4"),
  schema: FormSchemaV1,  // our Zod schema
  prompt: "Make me a 5-question NPS survey for a B2B SaaS product.",
});
// schema is already validated; drop straight into the builder canvas.
```

**(b) Summarize responses** — creator-side, post-decrypt, via `streamText`
```ts
const { textStream } = streamText({
  model: openrouter("anthropic/claude-sonnet-4"),
  prompt: `Summarize these survey responses:\n\n${JSON.stringify(decryptedResponses)}`,
});
// Stream tokens into the UI. Decrypted responses never leave the browser.
```

**(c) Translate form** — creator-side
Send block labels/descriptions to the model; save a translated schema variant.

#### Non-goals

- No hosted AI plan. BYOK is the entire model.
- No auto-analysis of responses. AI buttons are explicit, one-click, opt-in.
- No `/api/ai-proxy` on our server (we could add one post-hackathon for users who don't want to manage keys, but it's not in MVP).

---

### 7.4 Storage — Sui inline for the mandatory path, Walrus only for opt-in features

In v0.4 we minimised the WAL surface after noticing that **Enoki sponsors SUI gas but not Walrus WAL**. Anything that goes into Walrus creates a WAL-payment problem that Enoki cannot solve — either the respondent pays WAL (bad UX), or the creator pre-funds WAL (friction), or we run a WAL pool (extra managed system).

The answer is to **put both the form schema and the encrypted submission body inline in their respective Sui objects**, so the mandatory publish-and-submit path touches zero Walrus.

#### What's inline in Sui (zero WAL)

- **Form schema JSON** → inline in `Form.schema: vector<u8>` (hard-capped at ~100 KB).
- **Encrypted submission body** → inline in `Submission.encrypted_body: vector<u8>` (hard-capped at 200 KB ciphertext).

Both are paid for by SUI gas — creator pays once at publish, respondent's submit is sponsored by Enoki.

#### What still uses Walrus (WAL required, all opt-in)

| Asset | When it costs WAL | Who pays |
| --- | --- | --- |
| Cover / theme image | Creator optionally uploads a form cover | Creator at publish |
| `FILE_UPLOAD` attachments | Only if the form has a FILE_UPLOAD question and a respondent attaches a file | Creator-prefunded allowance OR app WAL pool on testnet |
| Mode B renderer bundle | Only if the creator opts to deploy their form as its own Walrus Site | Creator at deploy |

**A form with no cover image, no `FILE_UPLOAD` blocks, and no Mode B deploy → consumes zero WAL end-to-end.** That's the default path.

#### Why this is safe

- Typical form schema is 5–50 KB. 100 KB cap is comfortably above real-world sizes (≥ 500 questions).
- Sui object size limit is well above 250 KB; both our caps (100 KB schema + 200 KB ciphertext) sit inside limits even if they land in the same transaction.
- One sponsored `submit()` tx writes a Submission and copies the ciphertext — gas cost absorbed by Enoki quota (testnet: free).
- Reading for stats is simpler too: one paginated `getOwnedObjects` / event-query returns the schema with the Form and the ciphertext with each Submission. No separate Walrus round-trips.

#### The solution: store the ciphertext inline in the Move Submission object

Encrypted submission bodies for the MVP are typically **1–5 KB** (text answers, numbers, choices — Seal ciphertext adds ~100 bytes of overhead per body). That easily fits inline in a Sui object.

- **Cost model:** the gas cost of writing those bytes is part of the `submit()` transaction, which Enoki already sponsors. No separate WAL payment, no second sponsor layer.
- **Stats friendliness:** computing dashboard aggregates requires the creator to decrypt every submission. Fetching N `Submission` objects from Sui in a single paginated query (already needed for counting anyway) returns the ciphertext too — one network round trip per page. If the body lived in Walrus, every submission would need an extra Walrus fetch.
- **Deletion semantics:** destroying a `Submission` object on Sui actually wipes the ciphertext. Walrus blobs hang around until their storage epochs expire.
- **Sui object size.** The hard limit is well above 5 KB; we cap encrypted body size at ~200 KB in the `submit()` entry function to stay safely within bounds and prevent gas-bomb griefing.

#### When does Walrus still make sense?

For **bulk data that isn't on the gas-sponsored write path**:

- **Cover image** — optional, written once at publish by the creator. Creator pays WAL (small, one-time, skippable by not using a cover).
- **File attachments** inside `FILE_UPLOAD` blocks — can be megabytes per file, way too large for inline Sui storage. These are uploaded separately by the respondent; MVP approach is that the form's *creator* pre-funds a Walrus allowance (or we subsidize on testnet) so file-upload blocks still meet the "respondent pays nothing" promise.
- **Renderer bundle** for Mode B — deployed as a Walrus Site once per form, creator cost.

#### Stats question, answered

User asked: "lấy data để thống kê submission nên seal rồi để object ok hơn hay walrus blob ok hơn?" (for stats, is it better to seal into an object or into a Walrus blob?)

**Object is strictly better for stats.** Reasons:

1. One Sui RPC query (with pagination) returns both metadata and ciphertext. With Walrus you pay an extra blob fetch per submission.
2. Decryption is the same cost either way (Seal doesn't care where the ciphertext came from).
3. Stats queries are exactly what objects are designed for — `getOwnedObjects`, `getDynamicFields`, etc.
4. Latency: N Sui fetches in parallel (batched) < N Sui fetches + N Walrus fetches.

#### Full storage map (updated)

| Data | Location | Who pays | Token |
| --- | --- | --- | --- |
| **Form schema (JSON, ~5–50 KB)** | **Inline in `Form.schema`** | Creator at publish | SUI gas |
| Form ownership | Sui object (`Form` + `FormOwnerCap`) | Creator at publish | SUI gas |
| Access control rules | Sui (`Allowlist`, `FormSettings`) | Creator | SUI gas |
| **Encrypted submission body (ciphertext)** | **Inline in `Submission.encrypted_body`** | Enoki-sponsored | SUI gas |
| Submission metadata (submitter, timestamp, nonce) | Sui (`Submission` object) + event | Enoki-sponsored | SUI gas |
| Payment treasury | Sui `Coin<SUI>` | Native | SUI |
| Cover / theme image (optional) | Walrus blob | Creator at publish | **WAL** |
| File attachments (FILE_UPLOAD block, opt-in per form) | Walrus blobs (Quilt for multi-file) | Creator or app-pool (testnet = faucet) | **WAL** |
| Mode B renderer bundle (opt-in per form) | Walrus Site | Creator at deploy | **WAL** |
| Form draft in progress | Client IndexedDB | — | — |
| Response draft in progress | Client localStorage | — | — |
| AI API key | Client IndexedDB (encrypted) | — | — |
| AI-generated summaries | Client IndexedDB (cache only) | — | — |
| Cached decrypted responses | Client IndexedDB | — | — |

**Only the three bottom Walrus rows cost WAL, and all three are opt-in per form.** The baseline form costs zero WAL. Nothing that matters to ownership, access control, or audit trail lives only client-side — everything client-side is either ephemeral drafting state or a local cache of something rederivable from chain.

**Could we go further — no Sui Submission object per submit, just Walrus blobs?**

Yes, and it's a valid design knob. Tradeoffs:

| | With on-chain Submission (current design) | Without (Walrus-only) |
| --- | --- | --- |
| Per-submit gas | ~0.001–0.002 SUI (sponsored) | 0 |
| On-chain proof per submission | Yes | No (or deferred batch proof) |
| Submission counter (for rate limits, stats) | Yes on-chain | Must index off-chain |
| Discover submissions without an indexer | Yes (query events / objects) | No — Walrus is content-addressed, not queryable |
| Need a sponsor for gasless | Yes | No (no tx at all) |
| Creator workflow after collection | Straightforward | Must periodically batch-index blobs onchain |

**Decision: keep on-chain Submission objects for MVP.** The "walrus-only" path removes the on-chain proof value prop, which is the very thing differentiating us from a pure Walrus file uploader.

---

### 7.5 Defining "fully decentralized" — our honest position

Saying "fully decentralized" is marketing-grade ambiguous. Here's our actual claim, audit-ready:

| Layer | Decentralized? | Notes |
| --- | --- | --- |
| Form schema storage | Yes (Walrus testnet) | Censorship-resistant, no platform can remove |
| Submission storage | Yes (Walrus + Seal) | Seal whitelist policy — only creator and the submitter themselves can decrypt |
| Ownership / transfer | Yes (Sui object) | Standard onchain semantics |
| Access policy enforcement | Yes (Move + Seal) | Policies are smart contracts, not our server |
| Form renderer | Yes (Walrus Site) | Static Next.js export on Walrus Sites — no origin server |
| Builder portal | No | Ships on Vercel Next.js. Intentional tradeoff for iteration speed + sponsor API hosting. |
| Gas sponsorship | No (Enoki, app-paid) in v1 | Swappable for self-hosted sponsor or creator-funded reservoir v2. No data custody impact. |
| Identity | Respondent chooses | Respondent can use Slush / Sui Wallet / any installed wallet (self-custodial) **or** zkLogin (semi-decentralized via OAuth). Their choice. |
| Template marketplace | Yes (Sui Kiosk) | Standard onchain marketplace primitive |
| Discovery / search index | Partial (RPC query in v1, no server) | Thin indexer post-MVP for speed |

**Our public claim:** *"Data, ownership, and access control are fully decentralized. Convenience layers (Enoki sponsorship, Google OAuth via zkLogin) are replaceable without touching your data."*

Do not say "100% decentralized". Say exactly what's decentralized and exactly what's not. This is both honest and more defensible to judges.

---

## 8. Smart Contract Design

### 8.1 Modules

MVP modules marked with `*`. Others are scaffolded but not required by the MVP demo path.

```
apps/contracts/sources/
  form.move              * Form + FormSettings + FormStats
  form_owner_cap.move    * Owner capability
  allowlist.move         * VecSet<address> per form (used by allowlist + token-gated submit check)
  submission.move        * Submission + events
  payment.move           * Treasury for paid forms (testnet SUI)
  template.move          * FormTemplate + Kiosk integration (+ TransferPolicy royalty rule)
  seal_policies.move     * seal_approve_* entry fns (whitelist pattern, see §8.3)
  events.move            * Centralized event types

  gas_reservoir.move       Post-MVP (mainnet economics); lives in the repo as a sketch but not deployed for the hackathon
  receipt.move             Stretch — optional NFT receipt per submission
```

### 8.2 Core structs (authoritative sketch)

```move
// form.move
public struct Form has key {
    id: UID,
    owner: address,
    title: String,
    schema: vector<u8>,              // FormSchema JSON stored INLINE (see §7.4).
                                     // Capped at MAX_SCHEMA_BYTES to bound object size.
    site_object_id: Option<address>, // Only set if creator opted into Mode B Walrus-Site deploy
    cover_blob_id: Option<vector<u8>>, // Optional Walrus blob id for cover image
    theme: vector<u8>,               // Theme tokens (colors, font family) — small JSON, inline
    settings: FormSettings,
    stats: FormStats,
}

const MAX_SCHEMA_BYTES: u64 = 100_000; // 100 KB — ~500+ questions, well above real-world forms

public struct FormSettings has store {
    access_mode: u8,                // 0=public, 1=allowlist, 2=token, 3=paid
    allowlist_id: Option<address>,
    required_token_type: Option<TypeName>,
    required_token_amount: u64,
    submission_fee_mist: u64,
    max_submissions: u64,           // 0 = unlimited
    closes_at_ms: u64,              // 0 = never
    // Note: allow_anonymous, result_visibility, reader_allowlist, results_unlock_at,
    // sponsored_gas_enabled, gas_reservoir_id are intentionally omitted in v1.
    // Every submission has an identity (wallet or zkLogin); visibility is the
    // creator+submitter whitelist (see §4.5, §8.3).
}

public struct FormStats has store {
    submission_count: u64,
    total_revenue_mist: u64,
    last_submission_at_ms: u64,
}

// form_owner_cap.move
public struct FormOwnerCap has key, store {
    id: UID,
    form_id: address,
}

// allowlist.move
public struct Allowlist has key {
    id: UID,
    form_id: address,
    members: VecSet<address>,
    admin: address,
}

// submission.move
public struct Submission has key {
    id: UID,
    form_id: address,
    submitter: address,                // always a real address — no anonymous mode
    encrypted_body: vector<u8>,        // Seal ciphertext, stored INLINE (see §7.4)
    file_blob_ids: vector<vector<u8>>, // Walrus blob IDs for FILE_UPLOAD attachments only
    nonce: vector<u8>,                 // 16 random bytes; part of the Seal identity
    submitted_at_ms: u64,
    tx_digest: vector<u8>,
}

public struct SubmissionCreated has copy, drop {
    form_id: address,
    submission_id: address,
    submitter: address,
    body_len: u64,                     // indexers can track data volume without decrypting
    submitted_at_ms: u64,
}

// Enforced in submit() to keep objects bounded.
const MAX_ENCRYPTED_BODY_BYTES: u64 = 200_000; // 200 KB hard cap

// template.move
public struct FormTemplate has key, store {
    id: UID,
    creator: address,
    title: String,
    description: String,
    category: u8,
    schema: vector<u8>,                 // Inline schema JSON (same 100 KB cap as Form.schema)
    preview_blob_id: Option<vector<u8>>, // Optional Walrus preview image
    tags: vector<String>,
    created_at_ms: u64,
    clone_count: u64,
}

public struct TemplateCloned has copy, drop {
    template_id: address,
    buyer: address,
    price_paid_mist: u64,
    royalty_paid_mist: u64,
    new_form_id: address,
}
```

### 8.3 Seal policy entry functions — whitelist pattern

**Simplification (v1):** exactly two addresses can decrypt a given submission: **the form creator** and **the submitter themselves**. No time-lock, no reader allowlist, no public-after-close. This is the "whitelist pattern" the requirements call for.

```move
// seal_policies.move

const E_BAD_IDENTITY: u64 = 1;
const E_UNAUTHORIZED: u64 = 2;

/// Submission blob decryption: creator of the form OR the original submitter only.
/// Seal identity is expected to be sha256(form_id || submission.nonce),
/// which uniquely binds the ciphertext to this (form, submission) pair.
entry fun seal_approve_read_submission(
    id: vector<u8>,
    form: &Form,
    submission: &Submission,
    ctx: &TxContext,
) {
    assert!(identity_matches(id, form, submission), E_BAD_IDENTITY);
    let caller = tx_context::sender(ctx);
    assert!(
        caller == form.owner || caller == submission.submitter,
        E_UNAUTHORIZED,
    );
}

/// Encryption-time policy: allow the submitter to encrypt a new blob for this form,
/// gated by the form's access_mode. The sponsor layer and submit() call also
/// independently enforce these; seal_approve_submit exists so the ciphertext's
/// identity is bound to the form.
entry fun seal_approve_submit(
    id: vector<u8>,
    form: &Form,
    allowlist: &Allowlist,      // sentinel if not allowlist-gated
    ctx: &TxContext,
) {
    // access_mode dispatch:
    // - public:      always pass
    // - allowlist:   vec_set::contains(&allowlist.members, caller)
    // - token:       checked by submit() at call time; here we just re-assert identity
    // - paid:        same as token — enforced at submit()
}
```

### 8.4 `submit()` entry function (high level)

```move
public entry fun submit(
    form: &mut Form,
    allowlist: &Allowlist,                 // sentinel if not allowlist-gated
    encrypted_body: vector<u8>,            // Seal ciphertext, inline
    file_blob_ids: vector<vector<u8>>,     // Walrus blob IDs for FILE_UPLOAD attachments
    nonce: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // 1. Size cap (anti-gas-bomb)
    assert!(vector::length(&encrypted_body) <= MAX_ENCRYPTED_BODY_BYTES, E_BODY_TOO_LARGE);

    // 2. Deadline check
    if (form.settings.closes_at_ms != 0) {
        assert!(clock::timestamp_ms(clock) < form.settings.closes_at_ms, E_FORM_CLOSED);
    };

    // 3. Submission cap
    if (form.settings.max_submissions != 0) {
        assert!(form.stats.submission_count < form.settings.max_submissions, E_SUBMISSION_CAP_REACHED);
    };

    // 4. Access-mode checks (allowlist / token-balance — skipped for public)

    // 5. Build Submission with inline ciphertext, share it, emit SubmissionCreated,
    //    bump form.stats.submission_count.
}
```

### 8.5 Test plan

- `form_tests.move` — create / update-settings / close lifecycle, owner cap transfers
- `allowlist_tests.move` — add/remove/duplicate handling
- `submission_tests.move` — success path, duplicate prevention, deadline boundary, submission-cap boundary
- `template_tests.move` — publish (free + paid), clone, royalty flow, kiosk interactions
- `seal_policy_tests.move` — creator can read, submitter can read, third party cannot, identity-binding is enforced
- Integration (TS-side): end-to-end encrypt → submit → decrypt against Seal testnet, both as creator and as submitter

---

## 9. Storage Strategy

### 9.1 What lives where (detailed)

See §7.4 for the full matrix. Key operational notes:

- **Form schema** — inline in `Form.schema: vector<u8>`. No Walrus. Hard-capped at 100 KB. Paid for by the creator's `create_form` SUI gas.
- **Submission ciphertext** — inline in `Submission.encrypted_body: vector<u8>`. No Walrus. Hard-capped at 200 KB. Sponsored by Enoki as part of the `submit()` gas.
- **Cover image (optional)** — Walrus blob if creator uploads one. `Form.cover_blob_id` is `Option<vector<u8>>`; `None` for forms that skip cover.
- **File attachments (opt-in)** — uploaded to Walrus (Quilt batch for > 3 files per submission). IDs stored in `Submission.file_blob_ids`. Only path where a respondent's submit flow touches Walrus. Testnet: covered by app faucet-funded WAL pool.
- **Mode B renderer site (opt-in)** — deployed via `site-builder deploy` CLI (suiup-installed binary). Build with `next build` using `output: 'export'`. Target bundle < 350 KB gz. Creator pays WAL at deploy time.
- **Form URL** — Mode A default: `walform.wal.app/f/{form-id}` (no deploy needed, zero WAL). Mode B opt-in: `{form-id-base36}.wal.app`, upgradable to `{suins-name}.wal.app`.

### 9.2 Walrus cost back-of-envelope

From Walrus docs: users pay per encoded storage unit per epoch (WAL). Pricing is dynamic and plans to stabilize in USD.

Rough working numbers (verify with `walrus info` on target network before launch):

| Asset | Size | Storage epochs | Relative cost | Mandatory? |
| --- | --- | --- | --- | --- |
| Cover image (optional) | ~100 KB | ≥10 | low | No |
| Renderer bundle (Mode B) | ~350 KB | ≥10 | low | No (opt-in) |
| File attachment (1 MB) | 1 MB | ≥10 | moderate | No (only if form has FILE_UPLOAD) |
| ~~Form schema~~ | ~~5–50 KB~~ | **inline in Sui `Form`** | — | — |
| ~~Submission body~~ | ~~5 KB~~ | **inline in Sui `Submission`** | — | — |

For the hackathon: every Walrus cost falls on creator accounts (or the app's WAL pool for file uploads), backed by free testnet faucet WAL. **Mandatory WAL = zero.** No mainnet economics in v1.

### 9.3 Encryption scheme (Seal, whitelist pattern)

- **Identity construction for submissions:** `sha256(form_id || submission.nonce)`. Uniquely binds the ciphertext to (form, submission) and enables the `identity_matches(id, form, submission)` check in `seal_approve_read_submission`.
- **Policy:** `seal_approve_read_submission` — caller must be `form.owner` **or** `submission.submitter`. See §8.3.
- **Ciphertext location:** inline in the `Submission` object (`encrypted_body: vector<u8>`). Fetched together with metadata in one Sui RPC call.
- **Threshold config (MVP):** t=2, n=3 Seal testnet key servers.
- **Session key:** any reader (creator or submitter) signs a personal message once per dashboard session; the derived session key is cached in memory only.
- **Decryption parallelism:** creator flow fetches all `Submission` objects for the form (single paginated query returns ciphertext inline), batch-requests key shares, combines, decrypts in parallel (Promise.all with a concurrency limit of 10). Submitter flow decrypts a single submission — trivial.

---

## 10. Form Schema JSON Spec (v1.0)

```ts
type FormSchemaV1 = {
  version: "1.0";
  id: string;                         // UUID client-generated pre-publish
  title: string;
  description?: string;
  cover?: { blob_id: string; alt: string };
  theme: {
    primary_color: string;            // hex
    font_family: string;
    background?: string;
    button_style?: "rounded" | "sharp";
  };
  pages: Page[];
  logic: LogicRule[];
  locale?: string;                    // BCP 47, e.g. "en" / "vi"
  settings: {
    show_progress: boolean;
    show_question_numbers: boolean;
    require_wallet: boolean;
    sponsored_gas: boolean;
    submit_button_text: string;
  };
};

type Page = { id: string; blocks: Block[] };

type Block = QuestionBlock | LayoutBlock | EmbedBlock | AdvancedBlock;

type QuestionBlock = {
  id: string;
  kind: "question";
  type:
    | "SHORT_ANSWER" | "LONG_ANSWER" | "MULTIPLE_CHOICE" | "CHECKBOXES"
    | "DROPDOWN" | "NUMBER" | "EMAIL" | "PHONE" | "URL" | "DATE" | "TIME"
    | "RATING" | "LINEAR_SCALE" | "SIGNATURE" | "FILE_UPLOAD"
    | "PAYMENT" | "WALLET_CONNECT";
  label: string;
  description?: string;
  required: boolean;
  validation?: ValidationRules;
  options?: string[];
  config?: Record<string, unknown>;   // block-specific (e.g. Payment: {amount_mist, currency})
};

type LayoutBlock = {
  id: string;
  kind: "layout";
  type: "HEADING" | "TEXT" | "DIVIDER" | "PAGE_BREAK" | "THANK_YOU";
  content: string;
  level?: 1 | 2 | 3;
};

type EmbedBlock = {
  id: string;
  kind: "embed";
  type: "IMAGE" | "VIDEO";
  blob_id: string;
  alt?: string;
};

type AdvancedBlock = {
  id: string;
  kind: "advanced";
  type: "HIDDEN" | "COMPUTED";
};

type LogicRule = {
  id: string;
  when: { block_id: string; operator: "eq"|"neq"|"contains"|"gt"|"lt"|"in"; value: unknown };
  then: { action: "SHOW"|"HIDE"|"GOTO_PAGE"|"SKIP_TO_END"; target: string };
};

type ValidationRules = {
  min_length?: number;
  max_length?: number;
  min_value?: number;
  max_value?: number;
  pattern?: string;       // regex
  custom_error?: string;
};
```

### Submission envelope (pre-encryption, what the creator sees after decrypt)

```ts
type SubmissionV1 = {
  form_id: string;
  form_schema_hash: string;            // SHA-256 of the inline schema bytes at submit time
  submitted_at_ms: number;
  responses: Record<string, unknown>;  // block_id -> answer
  metadata: {
    time_spent_ms: number;
    pages_completed: number;
    user_agent?: string;
    wallet_signed?: string;            // optional proof-of-wallet-control signature
  };
  attachments?: {
    block_id: string;
    file_blob_id: string;
    file_name: string;
    file_size: number;
    mime_type: string;
  }[];
};
```

---

## 11. MVP Scope (Hackathon Deliverables)

### Must ship — Weeks 1–2

**Monorepo foundation**
- Turborepo + Bun workspace with `apps/builder`, `apps/renderer`, `apps/portal`, `apps/contracts`, and a single `packages/core`
- `packages/core` holds shadcn primitives + Tailwind preset + Zod schemas + Sui/Walrus/Seal helpers, all flat under `src/`

**Frontend — builder app (Next.js 15, Vercel)**
- Canvas with 8 question blocks: Short, Long, MC, Checkboxes, Number, Email, Date, Rating
- 4 layout blocks: Heading, Body, Divider, Page break
- Settings panel: public / allowlist / token-gated / paid, **max submissions** + **closes_at** (both optional)
- Publish flow: schema → Walrus, `create_form` tx on Sui testnet. Mode B Walrus-Site deploy is a creator checkbox at publish (optional).
- **`/f/[id]` route** (Mode A built-in renderer) — server fetches Form object + schema, client handles fill + submit
- Dashboard: list owned forms, view submissions table (inline ciphertext decrypted via Seal whitelist policy), charts, CSV export
- Template gallery (read-only browse for MVP) + clone-free-template flow
- AI: "Generate form from prompt" via Vercel AI SDK v6 + OpenRouter BYOK
- `/api/sponsor` route holding `ENOKI_SECRET_KEY`

**Frontend — renderer app (Next.js 15 `output: 'export'`, Walrus Site, Mode B)**
- Imports `<FormRenderer>` from `packages/core` — identical component to Mode A
- `@mysten/dapp-kit` ConnectButton — lists Slush, Sui Wallet, Enoki zkLogin, and any other installed wallet
- Seal encrypt on submit (identity = `sha256(form_id || nonce)`)
- Build submit tx with **encrypted_body inline**; Walrus upload only if the form has FILE_UPLOAD blocks
- POST tx to `walform.wal.app/api/sponsor`, sign sender, broadcast. Respondent pays 0 SUI.

**Contracts (Sui testnet)**
- `form.move`, `form_owner_cap.move`, `allowlist.move`, `submission.move` (inline ciphertext), `seal_policies.move` (whitelist pattern)
- `template.move` + Kiosk `TransferPolicy` royalty rule
- Deployed; package ID tracked in `apps/contracts/deployed.json`

**Enoki + sponsor integration**
- Enoki dev-portal app configured for Sui testnet + sponsored-tx enabled
- Server-side `@mysten/enoki` in `/api/sponsor`; client-side `registerEnokiWallets` in builder and renderer
- Rate limit: 1 submit / address / form / day, enforced in `/api/sponsor`

### Nice to have — Week 3

- Token-gated mode (allowlist + token balance check)
- Paid forms with native testnet-SUI Payment block
- File upload via Walrus Quilt
- Paid templates + royalty flow via Kiosk `purchase` (no Payment Kit)
- Conditional logic UI (rules exist in schema; builder UI to author them)
- Thank-you page customization
- Theme editor
- AI: "Summarize responses" (creator-side post-decrypt, `streamText`)
- Mode B Walrus-Site deploy button + SuiNS attach flow for a polished `{name}.wal.app` URL
- **`apps/portal` — vendored Walrus Sites gateway** from `MystenLabs/walrus-sites/portal`. Deploy the Cloudflare Worker flavor to our Cloudflare account with testnet config pointing at Sui + Walrus testnet endpoints. This is the gateway that resolves `{form-id}.{our-domain}` → Walrus blobs for all Mode B deploys. Scope is vendor + configure + deploy, not build-from-scratch. Closes the "we operate the full Walrus Sites stack ourselves" decentralization story.

### Post-hackathon (v1.1+)

- Matrix, Ranking, Phone, URL, Time, Signature blocks
- Calculated fields
- Advanced analytics (drop-off funnel, per-question breakdowns)
- Team workspaces (multi-owner forms)
- Webhook / Zapier / direct integrations
- Video/audio embed blocks
- Multi-language forms (polyglot schema)
- Time-locked results + reader allowlist (for sealed-bid auctions, anonymous judging)
- `GasReservoir` Move module + creator-funded mainnet economics
- Self-hosted sponsor service (replace Enoki option)
- Tiny Sui event indexer (Postgres + GraphQL) for fast template gallery + creator analytics
- Per-form Walrus Site deploys (each form owns its own site object)

---

## 12. Development Roadmap

Hackathon timeline assumed ~3 weeks from kickoff. Adjust to Haulout dates.

### Week 1 — Foundation
- Turborepo + Bun scaffold: `apps/builder`, `apps/renderer`, `apps/portal`, `apps/contracts`, and a single `packages/core`
- `packages/core` with shadcn primitives, Tailwind preset
- Core Move modules compile + unit-tested + deployed to testnet: `form`, `form_owner_cap`, `allowlist`, `submission`, `seal_policies`
- Schema types + Zod validator in `packages/core`
- Builder: canvas + block library + 3 block types working end-to-end (short, MC, email) using `packages/core`
- Renderer: Next.js shell with `output: 'export'` rendering a hardcoded schema, hash-routing wired up
- Wallet connect (any wallet) + Enoki zkLogin in both apps
- `/api/sponsor` stub wired against Enoki testnet

### Week 2 — E2E submission path
- All 8 MVP question blocks + 4 layout blocks in both `<FormRenderer>` (packages/core) contexts: Mode A (builder `/f/[id]`) and Mode B (apps/renderer static export)
- Full publish flow: schema → Walrus, `create_form` tx on Sui. Mode B deploy is a toggle (can skip for Week 2 and test against Mode A only).
- Full submit flow: validate → Seal encrypt → `submit()` tx with **inline ciphertext** → POST /api/sponsor → sign sender → broadcast. **No Walrus write on the submit hot path** (attachments excepted).
- Dashboard: list forms, view submissions (paginated Sui query returns ciphertext inline, decrypt via Seal whitelist)
- Submitter receipt page (decrypt own submission)
- CSV export
- AI "generate form from prompt" via AI SDK v6 + OpenRouter (BYOK, IndexedDB)

### Week 3 — Differentiation + polish
- Token-gated access mode
- Paid forms (Payment block + treasury)
- File upload via Walrus Quilt (`FILE_UPLOAD` block — the only respondent-side Walrus write path)
- Template: publish-as-template + Kiosk listing + free-clone flow (paid clone as stretch)
- Mode B Walrus-Site deploy + optional SuiNS attach
- Theme editor + thank-you page customization
- Demo video recording (3 minutes, following §13 narrative)
- Submission write-up, architecture diagram, README polish

### Buffer day (last 24h)
- Bug-fix only, no new features
- Re-test full demo flow at least 3 times end-to-end on testnet
- Verify Sui testnet explorer links resolve, Walruscan shows blobs, Seal whitelist decrypt works cold from both creator and submitter accounts

---

## 13. Demo Narrative (3-minute video)

| Scene | Duration | Content |
| --- | --- | --- |
| 1. Hook | 0:30 | Split-screen: typical form builder with "account suspended" banner vs WalForm's always-online form. "Traditional form builders can suspend your forms, read your data, and go down anytime. WalForm is different — built on Sui + Walrus + Seal." |
| 2. Creator builds | 0:50 | Pick a template from gallery → clone via Kiosk (show testnet-SUI + 10% royalty) → edit in canvas → configure "DAO governance, token-gated, closes in 7 days, max 500 submissions". Click Publish → schema goes to Walrus, `create_form` tx on Sui. URL `walform.wal.app/f/{id}` is immediately live. |
| 3. (Optional) Walrus Site deploy | 0:15 | Toggle "Deploy to Walrus Site" → one-click `site-builder deploy` → attach SuiNS name `governance-q2.wal.app`. Same form, branded URL. |
| 4. Respondent submits | 0:45 | Open URL. Respondent picks **Slush** from the wallet list. Submit — 0 SUI, 0 WAL paid by respondent. Show the on-chain `Submission` on Sui explorer with the inline ciphertext field. Second respondent uses **zkLogin Google** — same flow, zero crypto for them. |
| 5. Creator views results | 0:30 | Dashboard → one-click decrypt via Seal whitelist policy → responses rendered + AI-summarized themes via AI SDK v6 (creator's own OpenRouter key). CSV export. |
| 6. Submitter receipt | 0:15 | Respondent returns to the form URL, reconnects the same wallet, sees their own submitted answers decrypted via the whitelist policy. |
| 7. Close | 0:15 | "Built on Walrus + Seal + Sui + Enoki. Decentralized data. Mainstream UX. walform.wal.app — Overflow 2026." |

---

## 14. Risks & Open Questions

### Technical risks

| Risk | Mitigation |
| --- | --- |
| Renderer bundle > 350 KB gz (Next.js static export overhead) | Profile early in Week 1. Aggressively lazy-load block modules; code-split per question type. Mode B is optional per form, so this only bites creators who opt into Walrus-Site delivery. |
| Next.js `output: 'export'` + dynamic routes biting us | Use hash routing from day one; never rely on server rewrites. |
| Walrus publisher flakiness / rate limits on testnet | Retry + exponential backoff in upload client (used only for schema + attachments, not submission bodies). Fallback to self-run publisher-proxy if needed. |
| WAL cost for file uploads on testnet | App-level WAL pool seeded from faucet. Cap per-attachment size. For demo we ensure the demo file fits. |
| Enoki testnet quota exhaustion or outage during demo | Pre-record the demo. Keep a "respondent pays own gas" emergency toggle wired. |
| Seal SDK API drift before hackathon deadline | Pin exact version in `bun.lockb`. Monitor changelog weekly. |
| Move contract bug discovered late | Time-boxed test writing in Week 1. Redeploy package as needed on testnet; track package ID in `apps/contracts/deployed.json`. |
| Inline ciphertext pushes Submission object over size limits | Hard 200 KB cap in `submit()`. Monitor typical sizes; if we see pressure, switch the FILE_UPLOAD-heavy path to Walrus before body. |

### Product / UX risks

| Risk | Mitigation |
| --- | --- |
| Creator expects Tally-level polish on drag-drop in 3 weeks | Rely on dnd-kit + shadcn patterns; don't invent UI. Cut theme editor before cutting core block list. |
| Respondent sees a technical "Sui transaction" dialog and bounces | Hide chain terminology. Submit button says "Submit". The only pop-up respondent sees is their wallet's own sign prompt (one click). |
| Submitter confusion: "can I still see my answers?" | Ship the submitter-receipt page in Week 2 — it's a direct differentiator vs Tally. |

### Open questions (need an answer before Week 2 ends)

1. **Do we need a publisher-proxy** (CORS / auth) for Walrus testnet, or does the public publisher suffice for hackathon traffic (schema + attachments only)? — Decide by end of W1.
2. **Template gallery indexing** — pure on-chain RPC query OK for MVP, or need a cached index for UX? Depends on how many templates exist at demo time.
3. **zkLogin provider coverage** — Google only, or also Apple / Twitch? Default Google only; add Apple if trivial.
4. **Which OpenRouter default model?** Likely Claude Sonnet for quality, or a cheap Haiku for cost-conscious users. Keep it user-configurable.
5. **Mode B trigger UX** — is "Deploy to Walrus Site" a publish-time checkbox, or a post-publish button on the form dashboard? The latter is less risky (creator can deploy after basic publish works). Default to post-publish.

---

## 15. Success Metrics (what judges will verify)

### Demo-verifiable
- Package ID live on Sui testnet explorer with on-chain activity visible
- At least 3 forms deployed with real submissions from 3+ different addresses
- Walrus Site accessible at `{id}.wal.app`; renderer loads and functions
- End-to-end demo video with real wallet signatures visible
- Seal encrypt + decrypt round-trip verifiable on camera
- Sponsored submission: show respondent account with 0 SUI balance successfully submitting

### Defendable differentiation claims
1. **First decentralized form builder on Sui** — specifically combining Walrus Sites + Seal + Sui + Enoki + Kiosk
2. **Only form builder whose frontend is censorship-resistant** (Walrus Site)
3. **Only form builder with native E2E encryption at rest** (Seal)
4. **Only form builder with a built-in onchain template marketplace** (Kiosk + royalty)
5. **Mainstream UX via zkLogin + sponsored gas** — respondent needs nothing but a Google account

### Quantitative (stretch)
- Unlimited sponsored submissions on testnet (Enoki-paid); record demo with 100+ successful submissions across 5+ distinct respondent accounts
- Renderer bundle < 350 KB gzipped (measurable in CI; Next.js static export)
- End-to-end submit latency < 5 seconds on reasonable network

---

## 16. What This Document Does Not Cover (yet)

- Detailed wireframes / Figma for the builder canvas, inspector, settings panels — to be drafted separately if design resource available.
- Exact Enoki subscription tier + billing alert thresholds — needs login to Enoki dev portal; track via ops ticket.
- Legal / ToS — E2E-encrypted submissions change liability profile; needs counsel review before mainnet.
- Token-economic design for any future $WALFORM token — explicitly out of scope for v1; hackathon project, not a protocol launch.

---

## Appendix A — Decision log (reference for future changes)

| Date | Decision | Status |
| --- | --- | --- |
| 2026-04-21 | Primary hackathon target = **Sui Overflow 2026**, 100% Sui testnet | Locked |
| 2026-04-21 | Walrus Haulout = secondary target with the same codebase | Locked |
| 2026-04-21 | **Both apps on Next.js 15**; renderer uses `output: 'export'` + hash routing to fit Walrus Sites | Locked (v0.3) |
| 2026-04-21 | Shared **`packages/core`** (shadcn + schema + sui/seal/walrus helpers + Tailwind preset, all in one flat package) consumed by both apps | Locked (v0.3) |
| 2026-04-22 | **`contracts/` moved to `apps/contracts/`** and 4 separate packages (`ui`, `core`, `sui`, `config-tailwind`) merged into one `packages/core` for brevity | Locked (v0.6) |
| 2026-04-24 | **Builder UI scaffolded from standalone form-builder reference** (Zustand + IndexedDB + 18 field types, drag-drop canvas, inspector, undo/redo, JSON/TS/Zod export). Shadcn primitives + field renderers + `<FormPreview>` + schema-gen in `packages/core`; authoring-only code (editor components, Zustand store, IDB service, hooks) in `apps/builder`. `<FormPreview>` refactored to accept `schema` as a prop so renderer can reuse it when the submission page lands. | Locked (v0.7) |
| 2026-04-24 | **Move contracts implemented** (all 8 modules per §8). Seal whitelist policy follows Mysten's canonical pattern: `seal_approve_read_submission` verifies inner identity = `form_id_bytes \|\| submission.nonce` then asserts caller ∈ `{form.owner, submission.submitter}`. Kiosk marketplace installs a single global `TransferPolicy<FormTemplate>` at package `init` with a custom 10% royalty rule routing to a shared `PlatformTreasury`. Publish + upgrade handled by `apps/contracts/scripts/{publish,upgrade}.ts`; upgrade preserves `originalPackageId` (Seal identity stability). TS codegen via `@mysten/codegen` emits bindings into `packages/core/src/sui/gen/`. | Locked (v0.8) |
| 2026-04-21 | **Turborepo + Bun** for monorepo | Locked (v0.3) |
| 2026-04-21 | **Enoki fully app-sponsored** (no creator reservoir for v1); any wallet works | Locked (v0.3) |
| 2026-04-21 | Sponsor API lives in builder Next.js `/api/sponsor` (only server route) | Locked (v0.3) |
| 2026-04-21 | Seal **whitelist pattern** (creator + submitter only); no time-locked / public-after-close / reader-allowlist in v1 | Locked (v0.3) |
| 2026-04-21 | AI via **Vercel AI SDK v6** + OpenRouter (default) / OpenAI (alt), BYOK client-side | Locked (v0.3) |
| 2026-04-21 | Kiosk + TransferPolicy for template marketplace | Locked |
| 2026-04-21 | **Single global `TransferPolicy<FormTemplate>` with a 10% royalty rule** routed to `PlatformTreasury` — set once at package `init`, covers every paid-template sale | Locked (v0.4) |
| 2026-04-21 | Builder app uses **standard Next.js build (NOT `output: 'export'`)** so `/api/sponsor` has a real server runtime | Locked (clarified v0.4) |
| 2026-04-21 | **Encrypted submission body stored INLINE in the Sui `Submission` object**, not in Walrus — Enoki sponsors SUI gas but not WAL, and inline gives us stats-friendly queries | Locked (v0.4) — supersedes the earlier "ciphertext to Walrus" decision |
| 2026-04-21 | **Form schema also stored INLINE in the Sui `Form` object** (not Walrus) with a 100 KB cap | Locked (v0.4) |
| 2026-04-21 | Walrus restricted to **opt-in features only**: cover image, `FILE_UPLOAD` attachments, Mode B renderer bundle. A form can be created and submitted with zero WAL. | Locked (v0.4) |
| 2026-04-21 | **No `allow_anonymous` mode.** Every submission has a signed wallet / zkLogin identity. | Locked (v0.4) |
| 2026-04-21 | **No Sui Payment Kit.** Paid-template checkout uses a direct Kiosk `purchase` PTB. | Locked (v0.4) |
| 2026-04-21 | **Two form-delivery modes** — Mode A (built-in on `walform.wal.app/f/{form-id}`) default, Mode B (Walrus Site + optional SuiNS) opt-in per form | Locked (v0.4) |
| 2026-04-22 | **`apps/portal` = vendored Walrus Sites gateway from [MystenLabs/walrus-sites/portal](https://github.com/MystenLabs/walrus-sites/tree/main/portal).** Cloudflare Worker flavor, configured for Sui + Walrus testnet, deployed to our Cloudflare account. Resolves `{subdomain}.{our-domain}` for all Mode B form deploys. Upstream commit SHA tracked in `apps/portal/UPSTREAM.md`. | Locked (v0.5) |
| 2026-04-22 | Landing page + public template gallery **stay inside the builder app** (Vercel), not on a separate Walrus Site. Mode B plus our self-hosted portal already carry the "decentralized delivery" story; the marketing page on Vercel is the acceptable tradeoff for iteration speed. | Locked (v0.5) |
| 2026-04-21 | Creator-funded `GasReservoir` Move module | Deferred to post-hackathon mainnet |
| 2026-04-21 | Time-locked results / reader-allowlist / sealed-bid mode | Deferred to post-MVP |
| 2026-04-24 | **Every WalForm tx is Enoki-sponsored** (creator ops + marketplace ops + respondent ops). Reverses the v0.4 posture of "creator pays their own gas". Sponsor allowlist in `apps/builder/lib/sponsor/allowlist.ts`; server-side admin-keypair fallback signs if Enoki rejects. Env flag `SPONSOR_CREATOR_OPS=false` can disable creator sponsoring if the Enoki quota is griefed. | Locked (v0.9) |
| 2026-04-24 | **Publish UX has two branches from one dialog**: (A) Publish on-chain → Public/Private + max_submissions + closes_at (+ allowlist for Private); (B) Publish to Marketplace → Kiosk listing Free or Paid (SUI price) with title/description/category/tags/preview. Both are sponsored. Private-form and Marketplace schema-encryption (Seal v2) lands when `NEXT_PUBLIC_ENABLE_SEALED_SCHEMA=true` + contracts upgraded with `seal_approve_read_form_schema` + `seal_approve_read_template_schema`. | Locked (v0.9) |
| 2026-04-24 | **`/forms` reorganised into Drafts + My Forms (On-chain Running / On-chain Ended / Marketplace) tabs.** Drafts hydrate from IDB via `useForms`. My Forms hydrates from `usePublishStore` (persisted in `localStorage[walform:publish]`) keyed by local formId. A follow-up PR will cross-reference the chain via `useSuiClientQuery('getOwnedObjects', ...)` for authoritative status (closed flag, submission count). | Locked (v0.9) |
| 2026-04-24 | **Custom wallet UI (shadcn-native)** replaces dApp Kit's built-in `ConnectModal` / `AccountDropdown`. `<WalletConnectModal>`, `<WalletChip>`, `<WalletDropdown>`, `<ConnectedIndicator>` live under `packages/core/src/sui/wallet-ui/*`. Dropdown keeps it minimal: address row + Copy and Disconnect only (no network switcher — network is controlled via env on the hackathon demo). | Locked (v0.9) |
| 2026-04-26 | **`apps/renderer` dropped. Mode B replaced with a single shared static shell on Walrus.** The previous plan (build a fresh Next.js `output: 'export'` per form, push each one to Walrus) didn't scale — N forms = N WAL blobs of identical JS. Replacement: build `packages/walform-site/` ONCE (vite/next static export bundling dApp Kit + Seal + sponsor client + `<FormSubmissionView>`), push to Walrus ONCE, get a stable shell blob id. Per-form Mode B deploy = `site_object::create` PTB pointing at the shared blob + optional SuiNS attach. The shell reads form id from URL hash (`#/f/{id}`), fetches the on-chain Form from Sui RPC, decrypts via Seal session key, submits via cross-origin POST to `walform.wal.app/api/sponsor`. Apps/builder's `/f/[id]` Mode A page stays as the always-on default + as the in-builder preview. `apps/portal` kept for local dev (resolves `{base36}.localhost:8080` → testnet Walrus blobs); production uses the public `wal.app` portal. | Locked (v1.0) |
| 2026-04-27 | **Browser-side Walrus push for Mode B.** Replaced "admin uploads once + ships blob-id manifest" with "browser uploads per deploy via user wallet". `WalrusWalletSigner` extends `@mysten/sui` `Signer`, delegating to dApp Kit's `useSignAndExecuteTransaction`. User's wallet pays Walrus registration tx + ≤1M MIST relay tip. | Locked (v1.1) |
| 2026-05-07 | **Removed app-level transaction sponsorship.** Every WalForm Sui tx is now signed and paid by the user's connected wallet via `useExecuteTransaction` (wraps dApp Kit's `useSignAndExecuteTransaction`). Deleted `/api/sponsor` + `/api/sponsor/execute` server routes, the `SponsorTarget` literal union + sponsor allowlist, the admin-keypair fallback signer, and the wallet-rebuild auto-recovery in the sponsor transport. Marketplace clone/purchase + respondent submit + creator publish/update/close + treasury withdraw + Mode B deploy all flow through user-paid signing now. Enoki is retained only for `registerEnokiWallets` (Google sign-in). The server-side `WALRUS_ADMIN_SECRET_KEY` (renamed from `SPONSOR_ADMIN_SECRET_KEY`) only pays Walrus storage cost for `/api/walrus/upload`; it does not sign any Sui tx on behalf of users. Older §6 / §7.1 prose describing sponsored gas + 3-tier fallback is kept for historical context but no longer reflects shipping behaviour. | Locked (v2.0) |
| 2026-06-02 | **Frontend migrated off Next.js → Vite 7 + react-router-dom v7.** Both `apps/builder` (→ `out/`) and `packages/walform-site` (→ `dist/`) are now static Vite SPAs; `packages/core` is fully decoupled from `next/*` (navigation→react-router `useNavigate`/`useSearchParams` + shared `ui/not-found.tsx`, link→RR `Link`/`<a>`, image→`<img>`, font→`@fontsource-variable/*` in `ui/fonts.ts`, theme→`@teispace/next-themes/client`). `process.env.NEXT_PUBLIC_*` is kept in source and text-replaced at build by the new `packages/build-config :: nextPublicDefine` Vite `define` helper (both apps read `apps/builder/.env.local`), so `core` stays bundler-agnostic. Tailwind v4 via `@tailwindcss/vite`. **Rationale:** after the v2.0 sponsorship removal + the static-export move, the app was a 100% client SPA, so the Next App Router was pure overhead (RSC payloads, `workStore` invariants, Suspense-for-`useSearchParams`); Vite fits a Walrus-hosted SPA and unlocks Rollup `manualChunks` control. The builder currently emits a single ~9.4 MB JS chunk (vs 77 Turbopack chunks) — vendor/lazy chunk tuning is deferred (see PROGRESS "Known issues"). | Locked (v2.1) |

## Appendix B — Key external references

- Sui Overflow hackathon: https://overflow.sui.io/
- Walrus Haulout hackathon: https://www.walrus.xyz/haulout
- Walrus main docs: https://docs.wal.app/
- Walrus Sites site-builder: https://docs.wal.app/docs/sites/getting-started/installing-the-site-builder
- Seal (Mysten Labs): https://seal.mystenlabs.com/how-it-works
- Enoki: https://docs.enoki.mystenlabs.com/
- Enoki sponsored tx (TS SDK): https://docs.enoki.mystenlabs.com/ts-sdk/sponsored-transactions
- Sui dApp Kit: https://sdk.mystenlabs.com/dapp-kit
- Sui Kiosk standard: https://docs.sui.io/standards/kiosk
- Next.js static exports: https://nextjs.org/docs/pages/guides/static-exports
- Turborepo: https://turborepo.com/docs
- Bun: https://bun.sh/docs
- Vercel AI SDK v6: https://ai-sdk.dev/
- OpenRouter: https://openrouter.ai/docs
- Slush wallet (Sui): https://slush.app/
