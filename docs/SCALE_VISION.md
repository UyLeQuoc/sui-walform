# WalForm — Scale Vision

This document inventories everything WalForm ships **today**, then projects what's possible on the Sui + Walrus + Seal + Enoki stack if we keep pushing in the same direction. Anything in §1 is verifiable against the repo; §2 onward is intentionally ambitious — pick what excites you, drop what doesn't.

---

## 1. What ships today

Verified against the codebase as of 2026-05-18 (mainnet packageId `0xb0268669…5d9c5303`).

### 1.1 Authoring

- **Notion-style drag-and-drop canvas** — block palette + slash menu + outline navigator + history (undo/redo with labelled snapshots).
- **18 input field types** — short / long text, email, phone, URL, number, date, time, single-choice, multi-choice, select, yes/no, rating, linear scale, code (multi-language syntax), file upload, plus presentational blocks (heading, description, markdown, divider, space).
- **Custom theme without code** — eight curated web fonts (Sans / Serif / Display / Mono), 11 accent palettes, five border-radius scales, card vs. page layout, Walrus-hosted cover image.
- **AI generate from prompt** — Vercel AI SDK + OpenRouter, BYOK in `localStorage`, robust manual JSON parse so free-tier models (Gemini Flash, Minimax) still hydrate the canvas.
- **IndexedDB drafts** — offline-first; survives reloads, never leaves the device until publish.
- **Auto-save with rev counter** — cross-tab clobber detection; "form was modified elsewhere" prompt before overwrite.

### 1.2 Access control & publishing

- **Four access modes**: Public · allowlist Private · Token-gated (`Coin<T>` balance) · Paid-per-submit in SUI.
- **Per-form allowlist** as a shared Sui object — owner adds/removes members on-chain; respondents prove membership via Seal whitelist policy.
- **Token-gating** — UI checks `Coin<T>` balance pre-submit. Honor-system enforcement (documented).
- **Paid forms** — `FormTreasury` shared object accumulates SUI from each submit; owner withdraws via cap-gated PTB.
- **Form lifecycle** — close form (stops new submits, existing stay decryptable), max submissions, deadline (epoch-aware close).
- **Two-step paid publish** with retry — handles the "publishable but no treasury yet" failure mode.

### 1.3 Encryption (Seal)

- **End-to-end encrypted submissions** — Seal-encrypted in the browser before they touch chain. Inline in `Submission` Sui object (no Walrus dependency for the hot path).
- **Sealed schemas for Private forms** — schema bytes encrypted with Seal; reading the questions requires allowlist membership.
- **Identity layout** = `form_id (32 bytes) || nonce (16 bytes)` — matches `seal_policies.move`.
- **SessionKey caching** — one personal-message sign per 30-min session.
- **Whitelist decrypt policy** — owner OR submitter OR co-reviewer can decrypt.

### 1.4 Collaboration

- **On-chain reviewers** — `walform::reviewers` module. Owner adds reviewer addresses; reviewers get Seal decrypt access to every submission. Perfect for hackathon judges, hiring panels, co-managed surveys.
- **Reviewing forms feed** — wallet auto-discovers every form they've been added to (via `ReviewerAdded` event scan).

### 1.5 Distribution (Mode A + B)

- **Mode A (default)** — form at `walform.wal.app/f?formId=…`. Flat static routes, no slug placeholders, fully `output: 'export'`.
- **Mode B (per-form Walrus Site)** — one-click "Deploy to Walrus Site" bakes a `config.json` with `{ formId, network }` into a shared static shell + uploads to Walrus via the creator's wallet. Pair with a SuiNS name → `your-name.wal.app/`. **Same outcome as paid services like Walgo, zero platform fee.**
- **Site manage dialog** — read live Site metadata, update name/description/cover atomically.
- **Re-deploy + Resume** — IDB caches the upload manifest so a failed atomic PTB doesn't force re-paying for Walrus storage.

### 1.6 Marketplace

- **Multi-buyer `TemplateListing`** — template stays alive after each clone; `clone_count` bumps; creator gets full listed price, platform treasury gets 10% royalty (floor 0.05 SUI).
- **Preview-then-publish purchase** — `purchase_template_only` pays creator + royalty, **mints no Form**. Buyer's schema lands in Drafts; they edit before publishing.
- **Free templates** — same flow without payment via `record_free_clone`.
- **On-chain voting** — `walform::voting` module. Toggle semantics (clicking the active arrow clears).
- **Filter + sort + preview** — search, category, status, newest / most-cloned / most-upvoted / top-rated. Preview dialog renders the template via the live `<FormPreview>` (read-only).

### 1.7 Gas / sponsorship

- **Sponsor with graceful fallback** — single `useExecuteTransaction` hook. Tries Supabase Edge Function (Enoki sponsor wrapper) first; on any failure (server down, allowlist denied, quota exceeded), falls back to wallet-paid `signAndExecuteTransaction`.
- **One Enoki key sponsors testnet + mainnet** — `createSponsoredTransaction({ network })` accepts both.
- **Allowlist embedded** — every entry function the app actually issues (40+ across `form`, `allowlist`, `submission`, `template`, `voting`, `reviewers`, `payment`) plus `0x2::transfer::public_share_object` and Walrus Sites entry fns.

### 1.8 Storage

- **Cover images + file uploads** — written to Walrus via the user's wallet (`useWalrusWalletUpload`). No app-controlled keypair.
- **Storage cost preview** — `WalrusClient.storageCost(bytes, epochs)` surfaced as a WAL row in PublishDialog when a cover is set.
- **Upload-relay auto-discovery** — SDK negotiates via `/v1/tip-config`, capped at safe maximum (1M MIST testnet, 50M MIST mainnet).

### 1.9 Wallets + identity

- **Multi-wallet** — Slush, Sui Wallet, any dApp Kit detected, plus Enoki zkLogin (Google).
- **Custom shadcn-native wallet UI** — `<WalletButton>`, `<WalletConnectModal>`, `<WalletDropdown>` (address + copy + "View on explorer" + admin link + disconnect), `<WalletChip>`, `<NetworkBadge>`.
- **Network-aware** — testnet ↔ mainnet switch at runtime; all per-network resources resolved live.

### 1.10 Results dashboard

- **Five tabs** — Summary, By question, Individual, Reviewers, Manage.
- **Aggregate charts** per choice / rating / scale field (recharts).
- **Decrypt-on-demand row table** — Seal decrypt per row, status badges (encrypted / decrypted / failed).
- **CSV export** — formatted by field type.
- **Per-submitter receipt** — `/f/receipt?formId=…` decrypts only the wallet's own submission via the same Seal policy.

### 1.11 Smart contracts

- **9 Move modules** — `form`, `form_owner_cap`, `allowlist`, `submission`, `template`, `seal_policies`, `payment`, `voting`, `reviewers`, `events`.
- **63+ Move unit tests** — green on both networks.
- **Two stable package identities** — testnet `originalPackageId 0x2d8b91…77289`, mainnet `originalPackageId 0x0128be…b64bb`. Current `packageId` bumps on upgrade; original stays for Seal namespace.

---

## 2. Near-term scale ideas

Things that fit the current architecture, ship in 1-4 weeks each, and unlock real value.

### 2.1 Encrypted analytics

- **Differential-privacy aggregates** — count, sum, average, percentile per field, computed without revealing individual answers. Use Seal + threshold decryption: each respondent's contribution is masked client-side; the aggregate is decrypted as a group.
- **Live counts** — submission count surfaces in real time via Sui event subscription (no decrypt needed; just count `SubmissionCreated`).
- **Conditional logic on encrypted answers** — branching surveys ("if Q3 == 'pro', show Q5") without exposing Q3 server-side. Logic evaluated client-side after Seal decrypt for the submitter; admin sees full path on decrypt.

### 2.2 Smarter access control

- **Capability-NFT gating** — accept any NFT type, not just `Coin<T>`. Check ownership via `getOwnedObjects` filter.
- **Reputation gating** — require ≥N successful submissions to a creator's other forms before this one accepts you. Walks the submission event index.
- **Geographic / time-window gating** — combine on-chain access mode with client-side IP/time check, sealed in policy comments.
- **Multi-sig forms** — require multiple owners (via a shared cap) to update / close / withdraw. Reuse Sui native multi-sig.
- **Reviewer quorum** — require N-of-M reviewers to confirm a submission before the creator can decrypt (escrowed Seal decryption).

### 2.3 Payments

- **Multi-token paid forms** — accept `Coin<T>` for any T, not just SUI. Treasury is per-coin-type via a generic `FormTreasury<T>`.
- **Subscription forms** — recurring fee per epoch / per submission window; cron-like enforcement via `closes_at_ms` rotation.
- **Bounty submissions** — creator escrows a SUI pot; submitter receives a payout when the creator marks their entry as "selected" (on-chain settlement).
- **Quadratic funding rounds** — accept N submissions per project, match contributions quadratically against a fixed pool. Form *is* the funding round.
- **Royalty splits** — each template publisher can specify multi-party royalty (e.g. co-creators split 60/40 of every paid clone). Generalises today's single-treasury model.

### 2.4 Marketplace expansion

- **Per-template reviewer slots** — the buyer auto-inherits the creator's reviewer config (or strips it).
- **Trending feed** — most-upvoted last 24h / 7d, scored by vote velocity vs. clone velocity.
- **Featured + verified creators** — DAO-curated badge backed by a shared object the DAO mutates.
- **Bundle templates** — sell a pack of related forms (NPS + retention + churn surveys) atomically. Single Sui object holds N templates.
- **Refunds / disputes** — escrowed listing balance, 7-day refund window for buyers, dispute resolution via `walform::voting`.
- **Royalty waterfall to contributors** — track template forks; ancestors of a popular template get a share of descendant clones (10% / 5% / 2% by depth, capped).

### 2.5 Distribution & UX

- **Per-form Walrus Site auto-link** — buy a `.sui` SuiNS at publish time straight from PublishDialog (one tx that publishes form + reserves name + links site).
- **Embeddable widget** — `<script src="walform.wal.app/embed.js" data-form-id="0x…">`. Walrus-hosted JS that injects an iframe.
- **Email collection without email custody** — respondents sign a Seal-encrypted "contact info" payload visible only to the creator. Replaces Mailchimp without giving us the addresses.
- **WhatsApp / Telegram / Discord bots** — bot relays form questions, encrypts answers client-side via the chat-platform's WebView, submits to Sui. Form becomes a chat conversation.
- **Voice forms** — record audio answer → upload encrypted blob to Walrus → store URL in submission. With on-device Whisper transcription, do it client-side.

### 2.6 Storage / Walrus

- **Quilt deduplication across forms** — submissions to the same form often have similar files. SDK already does content-hash dedup; surface the savings to the creator ("3 files reused, saved 1.2 WAL").
- **Walrus blob expiry alerts** — daemon scans form's Walrus objects, alerts owner 1 epoch before expiry, offers one-click extend.
- **Sharded large submissions** — current submission body is capped at 200 KB. Sharding: split a 10 MB submission into chunks, store each as a Walrus blob, encrypted submission body just holds blob ids + chunk order.

### 2.7 AI

- **Server-less smart suggestions** — AI suggests next fields based on form intent ("you have rating + text — add NPS computation block?").
- **AI-assisted decrypt summarisation** — creator decrypts all submissions, asks "summarise top 3 themes". Runs against decrypted plaintext entirely client-side (BYOK).
- **Multi-language form authoring** — AI translates form into 10 languages on the fly; each language is a separate schema variant under one Form.
- **Anti-spam scoring** — local LLM scores each submission for likelihood of being LLM-generated / spam; creator can hide low-quality submissions in the dashboard without deleting on-chain.

### 2.8 Indexer / API

- **WalForm Indexer** — separate worker (Rust on Walrus Sites?) that scans events into a structured database. Exposes:
  - `GET /forms?creator=0x…&status=running`
  - `GET /forms/:id/submissions?since=epoch`
  - `GET /templates?sort=trending`
- **GraphQL gateway** — typed schema for every Move struct, generated from `package_summaries/`.
- **Webhook delivery** — when a new submission lands, deliver to a creator-configured webhook (signed by the indexer's key for verification).
- **Real-time WebSocket** — `wss://walform.wal.app/forms/:id/submissions` streams new SubmissionCreated events.

### 2.9 Composability

- **WalForm + Suiverse** — list form template directly on Suiverse marketplace as an NFT; Suiverse's Kiosk handles royalties + transfers.
- **WalForm + Movement / Aptos via Wormhole** — accept submissions originating from Move L2s; bridge access proofs.
- **WalForm + Cetus** — paid forms can quote token prices in stablecoins via Cetus oracles, charging `1 USDC equivalent` in any supported coin.

---

## 3. Big visionary ideas

These reshape WalForm into something larger than "form tool". Months of work each, but each one is a credible thesis on its own.

### 3.1 WalForm Network — feedback as a Sui-native primitive

Right now we ship one app. Imagine a permissionless **feedback protocol** where:

- Anyone can spin up a "form router" (frontend) that talks to the same `walform::*` modules.
- Routers compete on UX, language, niche (e.g. crypto-only, education-only), but share the schema + access-control + decrypt layer.
- A creator publishes ONCE and their form is reachable from N routers — same Sui object, same Seal-encrypted submissions, no vendor lock-in.
- Routers earn a tiny fee (e.g. 1 BPS of paid submissions) for the UX work, paid via TransferPolicy royalty on the `Form` type.

WalForm becomes the **reference router + Move backbone**; the network keeps going if we disappear.

### 3.2 DePIN — community-run Seal & Walrus relays

Today we rely on Mysten Seal committee + public Walrus upload relays. Both are SPOFs.

- **Seal node operators** — stake WAL to run a Seal key-server node. Forms can pick their committee (default: globally-staked top 5).
- **Walrus relay operators** — same, for upload relay nodes. Form owners or respondents can pin the relay they trust most.
- **Slashing** — operators that fail decrypt / drop relay traffic get slashed via on-chain proof.

WalForm becomes the **biggest end-user of Seal + Walrus** + acts as the on-ramp for new operators.

### 3.3 zkProofs of survey results

Instead of (or in addition to) decrypting raw answers:

- Creator generates a **zkProof** of an aggregate property: "67% of respondents picked option A" without revealing which respondents.
- Proof verifiable on-chain via Sui Groth16 / PLONK verifier. Becomes a verifiable claim.
- Use cases: prediction markets backed by polls, DAO governance with verifiable turnout, regulated surveys (GDPR-compliant by design).

Needs: a SNARK circuit per aggregate type. Halo2 + Sui's emerging zk-verifier modules.

### 3.4 Forms-as-NFT — selling completed datasets

A creator runs a form (e.g. "rate this AI model's output") for N respondents. Each respondent gets paid in micropayments. At the end, the *completed, decrypted dataset* is minted as a single NFT and listed on Sui Kiosk for sale to ML teams.

- Datasets-as-Kiosk-NFTs. Royalty splits flow back to respondents proportional to contribution.
- WalForm becomes a **decentralised RLHF / annotation marketplace**.
- Privacy preserved via aggregate proof or selective field reveal.

### 3.5 Forms as governance interface for any Sui project

Every Sui DAO needs surveys, RFCs, governance votes. Today they bolt on Snapshot (off-chain), Aragon (EVM), or roll their own.

- WalForm exposes a **headless mode**: third-party governance frontends call our Move modules + Seal policies, render their own UI.
- Plug-and-play: `<WalformGovernance daoAddress={…} formId={…} />` React component.
- Voting weight via `Coin<T>` balance or NFT holdings — all already there.
- Sui DAOs (e.g. Scallop, Cetus, Bucket) replace their patchwork governance with one composable primitive.

### 3.6 Cross-program composability

A `Form` is just a Sui object. Other Move packages can depend on it:

- **Insurance protocol** — claims processed via WalForm "claim form" objects; policy auto-pays when reviewers sign off.
- **Lending protocol** — KYC questions captured via WalForm; encrypted answers prove identity without exposing it to the lender (decrypt only on default).
- **Education platform** — quizzes are WalForm objects; grades are reviewers' decrypted decisions; certificates auto-mint on pass.

This is the **Composable Forms thesis**: any Sui project needing structured user input from anyone, anywhere, with cryptographic guarantees, depends on `walform::form`.

### 3.7 SuiNS-native form discovery

Today people share form URLs. Imagine:

- `forms.alice.sui` → a directory of every form Alice has published.
- `nps.acme.sui` → the latest NPS survey from ACME.
- `feedback.cetus.sui` → user-feedback channel for a protocol.

A SuiNS subname → Sui `Form` object id mapping. Discoverable via a public Walrus-hosted SuiNS resolver. Every creator gets a vanity URL space for free.

### 3.8 Real-time collaborative authoring

Today the editor is single-user (IndexedDB drafts). Add CRDT (Yjs / Automerge) syncing over a Walrus blob — co-authors edit simultaneously, no server needed:

- Each edit → append to a Walrus log blob (write-only).
- Replicas merge CRDT operations on read.
- Permissions enforced by Seal whitelist: only co-editors can decrypt the log.

WalForm becomes the **Figma of decentralised forms**.

### 3.9 On-chain provenance + tamper-proof receipts

For regulated / legal / hackathon contexts:

- Each submission has a `submitted_at_ms` timestamp + Sui tx digest = legally provable submission moment.
- Court / arbitration can verify: "this answer was given on this date, by this address, decrypted by these reviewers."
- WalForm becomes a **notarised survey platform** — replaces e-signature + survey tools for legal teams.

### 3.10 Compose with prediction markets

- A form *is* a prediction market: "Which option will get the most votes by epoch X?"
- Respondents pay to vote; correct predictors win the pot.
- Tie-in with Sui's emerging prediction market projects (Steamm, Bluefin) — they integrate as a "settle from a WalForm result" callback.

### 3.11 Hardware integrations

- **WalForm Terminal** — kiosk mode on a tablet, NFC tap → wallet sign → submit. Replaces SurveyMonkey kiosks in airports / events.
- **WalForm Reader** — read-only mode for a Raspberry Pi at an event entrance: respondents scan a QR, sign with their phone wallet, walk in. No central database of attendees.
- **Walrus Sites as kiosk software** — the terminal app itself is a Walrus Site running on the kiosk's local browser. Software updates = push a new Walrus blob, kiosk auto-fetches.

### 3.12 ZK-verified human input ("are you a real person")

Combine WalForm + zkLogin + WorldID-like proofs:

- Every submission carries a proof-of-personhood (Enoki zkLogin already proves "Google account"; layer on iris/face proof from emerging Sui zk infra).
- Creators can require "1 unique human per form" — sybil-resistant surveys, airdrops, polls.

---

## 4. What to pick next

If forced to ship in priority order for impact-per-week:

1. **Walrus blob-expiry alerts** (§2.6) — low effort, prevents data loss.
2. **WalForm Indexer + GraphQL** (§2.8) — unlocks every downstream integration.
3. **Forms-as-NFT datasets** (§3.4) — strongest narrative for next hackathon.
4. **Headless mode for DAOs** (§3.5) — partnerships with existing Sui DAOs.
5. **Real-time collaborative authoring** (§3.8) — strongest UX upgrade.

Everything else is opportunistic — pick whatever aligns with whoever pays attention next.

---

## 5. North star

> Forms are the smallest unit of *human-typed input*. Every protocol, every product, every community runs on them. Today they're a centralised wasteland — Google Forms / Typeform / SurveyMonkey, with your data on someone else's S3.
>
> WalForm makes "structured human input" a Sui primitive — Move-native, Seal-encrypted, Walrus-hosted, composable. Once that's a primitive, every other Sui project that needs feedback / data / governance / KYC / RLHF stops reinventing it.
>
> The end state is **not "WalForm grew big"** but **"every Sui project uses `walform::form` like they use `0x2::coin`."** That's the thing worth building.
