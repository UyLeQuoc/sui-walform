# Walrus Session 2 — Form Tooling Submission

> Pre-filled answers for <https://airtable.com/appoDAKpC74UOqoDa/shrN8UbJRdbkd5Lso>.
> `(FILL)` markers are fields that need a human decision before submission.

---

## Overview

**WalForm** is a decentralized form builder that lives end-to-end on Sui + Walrus + Seal. Every form schema is a Sui object, every submission is a Seal-encrypted Walrus blob, every site can be deployed to its own Walrus URL with a SuiNS name. Creators get a polished drag-and-drop builder; respondents get one-click submit with sponsored gas; no platform — including us — can read submissions or take a form down.

### Features at a glance

- **End-to-end Seal encryption** — submissions encrypted in the browser before they touch Walrus. Private forms also encrypt the schema itself.
- **One-click per-form Walrus Site deploy — no platform fee.** Same outcome as paid services (e.g. Walgo); we take zero. Creator's wallet pays Walrus storage + Sui gas directly.
- **SuiNS-friendly URLs.** Default `<base36>.wal.app/`, link a name → `your-brand.wal.app/`. No formId in the URL.
- **Four access modes**: Public, allowlist Private, token-gated by `Coin<T>` balance, paid-per-submit in SUI.
- **On-chain reviewers.** Owner adds co-reviewer addresses; they decrypt the same submissions via a Seal whitelist policy. Perfect for judging panels and co-managed surveys.
- **Sponsored gas with a graceful fallback** via Enoki + a thin Supabase Edge Function; if it's down, the connected wallet pays — same code path, no error screen.
- **Custom theme without code** — 18 input field types, 8 web fonts, 11 accent palettes, 5 radii, card/page layout, Walrus-uploaded cover image.
- **AI-assisted generation** (BYOK OpenRouter) — describe the form, hydrate 18 field types onto the canvas client-side.
- **Multi-wallet sign-in** — Slush, Sui Wallet, any dApp-Kit wallet, or burner Google via Enoki zkLogin.
- **Multi-buyer template marketplace with on-chain voting.** Free clones cost nothing; paid clones route 10% royalty to the platform treasury. Upvote / downvote tracked on-chain (`walform::voting`).
- **Results dashboard** — aggregate charts per choice / rating / scale, by-question panel, decrypt-on-demand row table, CSV export, per-submitter private receipt.
- **Walrus-backed file uploads** — `FILE_UPLOAD` fields write bytes to Walrus via the user's wallet; the URL is sealed inside the encrypted submission body.
- **Network-aware** — testnet + mainnet swap from the wallet dropdown; all per-network ids resolved at runtime.

---

## Form fields

### Project name *

WalForm

### Please select the session *

Walrus Session 2 — Form Tooling

### Team Leader Name *

`(FILL)` — full legal name

### Team Leader Email *

lequocuyit@gmail.com

### Newsletter opt-in

`(FILL)` — check or leave blank

### Team Leader Telegram Handle

`(FILL)` — `@your_handle` (optional)

### Discord handle *

`(FILL)` — `your_handle#0000`. Confirm you've joined <https://discord.gg/walrusprotocol>.

### Country *

`(FILL)` — Vietnam (likely)

### DeepSurge project Link *

`(FILL)` — Required to be on mainnet. Link to the DeepSurge submission entry for this project.

### Form Link *

`(FILL)` — link to the live registration form created via WalForm itself (eat-your-own-dog-food). Format: `https://<your-walrus-site>.wal.app/` after Mode B deploy, or `https://walform.wal.app/f?formId=0x…` if using Mode A.

### Confirmation — submitted at least one feedback entry through my own tool, and `0xc4d6ee019649edba41d5a5ed1081fe3c86afc41fea413195dd6ecdd0f6090e54` is an admin *

✅ Confirmed. The address has been added as a reviewer on the WalForm submission form via the Manage tab (`reviewers::add_reviewer`). It can now decrypt every submission and add further admins.

### Workflow and functionalities of the forms *

**Creator flow (admin):**

1. Connect wallet (Slush / Sui Wallet / Google zkLogin) on `walform.wal.app`. Network switcher in the dropdown — testnet or mainnet.
2. **Design** — drag-drop 18 field types on a Notion-style canvas, or describe the form to AI (BYOK OpenRouter) and hydrate it in one prompt. Customise font / colour / radius / cover image (Walrus-hosted).
3. **Publish** at `/forms/edit?formId=…` → opens `PublishDialog`. Pick access mode (Public / Allowlist Private / Token-gated / Paid-per-submit) + optional max-submissions + closes-at. Schema is committed to a Sui `Form` object; Private forms also encrypt the schema with Seal.
4. **(Optional) Deploy to Walrus Site** — one click on `/forms/results?formId=…`. Bundle uploads to Walrus from the creator's wallet (no platform fee). After deploy, `LinkSuinsPanel` lets the creator attach a SuiNS name so the URL becomes `your-name.wal.app/`.
5. **Add reviewers** — paste addresses on the Manage tab; they get Seal decrypt access via `reviewers::add_reviewer`.
6. **Review** at `/forms/results?formId=…`. Summary / By question / Individual / Reviewers / Manage tabs — aggregate charts, per-submission decrypt, CSV export, per-row tagging.
7. **Lifecycle** — Close form (stops new submits, existing stay decryptable), withdraw paid-form treasury, share link with one click, re-deploy or update Walrus Site metadata.

**Respondent flow (user):**

1. Open the shared link — either `walform.wal.app/f?formId=…` (Mode A) or `<creator>.wal.app/` (Mode B, formId baked into config.json).
2. Connect wallet or sign in with Google (Enoki zkLogin produces a fresh Sui address — no real identity required).
3. Fill the form (rich text, dropdowns, ratings, file uploads, etc.).
4. Submit — submission is Seal-encrypted in the browser, file attachments go to Walrus via the connected wallet, and a `submission::submit_and_share` PTB is sent (gas sponsored via Enoki + Supabase Edge Function, falls back to wallet-paid if sponsor is down).
5. Get a **private receipt** at `/f/receipt?formId=…` — only the submitter and form owner / reviewers can decrypt it.

### Share any visuals of your form *

`(FILL)` — drop screenshots from:
- `walform.wal.app/` (landing)
- `/forms` Drafts / On-chain / Marketplace tabs
- `/forms/edit?formId=…` editor (drag-drop canvas)
- `PublishDialog` showing 4 access modes
- `/forms/results?formId=…` Summary tab (aggregate charts)
- `/forms/results?formId=…` Manage tab (Deploy to Walrus Site + Link SuiNS panel)

### Demo video (≤ 3 minutes) *

`(FILL)` — upload `walform-demo.mp4`. Suggested beats:
- 0:00 — Connect wallet + sign in with Google zkLogin.
- 0:15 — AI-generate a feedback form from a prompt.
- 0:30 — Tweak schema in the canvas; pick Allowlist Private access mode.
- 0:50 — Publish; show on-chain Form object in Suivision.
- 1:05 — Open the form, submit a Seal-encrypted response with a file attachment.
- 1:25 — Open Results dashboard, decrypt the row in browser.
- 1:40 — Add a reviewer address; switch wallet to the reviewer; show co-decrypt.
- 1:55 — Deploy to Walrus Site, link a SuiNS, show the new `<name>.wal.app/` URL.
- 2:30 — Recap: zero platform fee, no server-side decrypt, fully on-chain.

### Which features set your solution apart? *

1. **Zero-platform-fee per-form Walrus Sites.** Same one-click deploy as paid alternatives (e.g. Walgo), but WalForm takes nothing — the creator's wallet pays Walrus + Sui directly. Shared bundle + 60-byte `config.json` per form means re-deploys are cheap.
2. **End-to-end Seal encryption with reviewer support.** Most form tools hand-wave "encrypted at rest"; WalForm's Move `reviewers` module is the access-control source of truth, and the Seal whitelist policy enforces it on every decrypt request. Co-judges work natively, no separate accounts.
3. **Sponsored gas with graceful fallback.** A Supabase Edge Function wraps Enoki's sponsor API; if it's down, the same code path falls back to wallet-paid `signAndExecuteTransaction`. Respondents never see "service unavailable".
4. **Multi-network at runtime.** Testnet + mainnet switch from a single wallet dropdown, no rebuild. Per-network packageId / treasury / allowlist all resolved live.
5. **Template marketplace with preview-then-edit purchase.** Buyers don't get a live form on-chain immediately — `purchase_template_only` pays the creator + 10% royalty, then the schema lands in their Drafts, they edit before publishing. Fixes the "buyer's remorse" failure mode of normal Kiosk clones.
6. **Type-safe Move codegen + dApp Kit 2.0 wiring.** `@mysten/codegen` generates TS bindings for every Move entry fn; every tx is built via the canonical `useExecuteTransaction` hook with a pinned `chain:` so wallets can't broadcast on the wrong network.
7. **Custom theme without code.** 8 web fonts × 11 palettes × 5 radii × card / page layout, persisted with the form on-chain. Cover image uploaded to Walrus directly from the browser.
8. **Network-aware URL builder.** Every internal link goes through `formsRoute.*()` — flat static routes (`/forms/edit?formId=…`, `/forms/results?formId=…`) so the entire builder ships as `output: 'export'` and lives on Walrus itself.

### Feedback about building on Walrus *

What worked well:

- **Walrus SDK + dApp Kit signer pattern** — wiring `WalrusWalletSigner` so the SDK can drive `writeBlob` / `writeFiles` via the user's connected wallet was clean once we discovered the pattern. End users pay WAL directly; no app-controlled keypair.
- **Quilts** — bundling all site files into a single quilt makes the per-form deploy one Walrus registration tx plus the Sui Site PTB. Two wallet prompts total.
- **Upload-relay tip auto-discovery** — letting the SDK negotiate via `/v1/tip-config` removed a whole class of "wrong tip" failures.

Challenges:

- **Quilt patch internal-id format isn't documented anywhere obvious.** The portal's `QuiltPatch.derive_id()` reads `x-wal-quilt-patch-internal-id` as a 5-byte hex string (version + LE start + LE end), but the SDK returns the full 37-byte base64url patch id. We hit "Hash mismatch 422" until we found the format by reading the portal source. A one-page doc on quilt header conventions would save every team a day.
- **`blobIdToInt` conversion isn't surfaced in the SDK's high-level API.** Walrus Sites Move expects `blob_hash: u256` decimal; the SDK returns blob ids as URL-safe base64. We had to import `blobIdToInt` from a deep path. A `walrusClient.getBlobIdU256()` helper would help.
- **TS SDK error messages from the upload relay are opaque** ("internal server error" with no context). Often the actual cause is a tip mismatch or a hash mismatch on the relay side. Surfacing the relay's structured response would unblock debugging significantly.
- **Walrus Site `update_metadata` requires owned (not shared) Site objects** — we discovered this by trial. Documenting the security model around shared-vs-owned sites would have saved us a half-day of "why can anyone edit my site metadata?" research.
- **No streaming upload progress for Quilts.** A single upload of N files reports done/total post-hoc; we want per-file progress for the deploy UI.

Suggestions:

- Bundle a `WalrusClient.estimateBlobCost(bytes, epochs)` helper.
- Surface upload-relay error bodies as structured fields, not just messages.
- Publish a short "porting a Next.js `output: 'export'` app to Walrus Sites" guide — covers `ws-resources.json`, routes table, `index.html` per directory, etc.
- A Walrus blob explorer that shows quilt patch ids decoded would be magic.

### X account

`(FILL)` — `@your_handle`. Allows tagging in winner announcement.

### Share link to X tweet *

`(FILL)` — link to your launch tweet announcing WalForm.

### SUI address *

`(FILL)` — your mainnet address. Builder/site deployer address used for publishing is `0x86fcc7fdc63be1a6b31c5288e7b87a6b985f16d1af490fcb54f2501d5fa8e78c`; replace with your own.

### GitHub *

`(FILL)` — `https://github.com/UyLeQuoc` (profile) + `https://github.com/UyLeQuoc/WalForm` (or whichever public repo).

### Session Feedback

`(FILL)` — Optional. Use the same content as the "Feedback about building on Walrus" answer, or add session-specific notes (kickoff session pacing, office hours availability, judging clarity, etc.).

### DeepSurge Feedback

`(FILL)` — Optional. Comments on DeepSurge's project portal: registration UX, judging cadence, communication channel, etc.

### Rules confirmation *

✅ I confirm that I have read, understood, and agree to the rules and regulations of Walrus Session 2.

---

## Pre-submit checklist

- [ ] Mainnet contracts live + verified on Suivision  
  - WalForm package: `0xb0268669794e23d88eb07370735edcf6e70a0618fd31409834b1cd665d9c5303`  
  - Original (Seal namespace): `0x0128bec074eff2c7ad03b52f45321c529958f75633d74668373e890d23fb64bb`  
  - Transfer policy: `0xeee9b6d63805e7f01e1dd9c7d329e8a67c19484cf6e22a28836cc0111f6ce928`  
  - Platform treasury: `0xd3576e1e42ab8dbccfe23c43b9e8b6da78daabd010d2a069809d1277da41530d`
- [ ] Builder deployed to Walrus Site (`walform.wal.app` or similar)
- [ ] Submission form deployed via WalForm itself (dogfood) on mainnet
- [ ] At least one real feedback entry submitted through the form
- [ ] `0xc4d6ee019649edba41d5a5ed1081fe3c86afc41fea413195dd6ecdd0f6090e54` added as reviewer on that form
- [ ] Demo video (≤ 3 min) uploaded to Walrus
- [ ] Repo public on GitHub
- [ ] Launch tweet posted, link copied above
- [ ] DeepSurge entry submitted on mainnet

---

## Prize categories

- **Main prize pool**: $1,500 total
- **6 × $50 WAL**: "Best Feedback regarding building on Walrus" — register in the form's Feedback field above.
- **Special prizes**: $200 WAL — call out anything special about WalForm worth flagging (e.g. dogfood-only submissions, zero-platform-fee site deploy, on-chain reviewer module).
