# Referral links

After submitting, a respondent gets a personal link. Everyone who submits through it is credited to
them **on-chain**, and the creator sees a leaderboard. Requested by a Walrus-team tester: Airtable can
only fake this with a hidden field and a prefilled URL.

## Decisions (2026-10-16)

| Question | Choice | Why |
|---|---|---|
| Where is the referral recorded? | On-chain event, with the referrer's `Submission` as proof | Counts are verifiable, and the referrer can see their own |
| What does the link carry? | The referrer's full Submission id (`?ref=0x…`) | No lookup needed; the UI shows a SuiNS name or a short address |
| Which forms? | Opt-in per form, off by default | "Who invited whom" becomes public on-chain |
| Who sees the leaderboard? | The creator in Results; the creator can also show it on the form page | Campaign forms want it public, sensitive ones don't |
| Referrer rewards | Not yet | Rewards make throwaway wallets profitable (sybil) |

## Contract — `referral.move` (compatible upgrade)

A new module; no existing module changes.

```move
public fun submit_and_share(form, allowlist, referrer: &Submission, body, files, nonce, clock, ctx)
public fun submit_paid_and_share(form, treasury, fee_coin, referrer: &Submission, body, files, nonce, clock, ctx)
```

Each one calls `submission::submit` / `submit_paid` (all the usual checks), then `record`:

- `E_REFERRER_WRONG_FORM` (1) — the referrer's Submission belongs to another form.
- `E_SELF_REFERRAL` (2) — the referrer is the new respondent.
- Emits `ReferralRecorded { form_id, submission_id, submitter, referrer, referrer_submission_id, submitted_at_ms }`, then shares the Submission.

`record` is private, so a referral can only be recorded while its Submission is being created: it
can't be added to an old Submission or recorded twice. Nothing on-chain checks the per-form opt-in
(the setting lives in the schema); the app only reads referrals for forms that enable them.

`ReferralRecorded` was introduced by an upgrade, so its type is tagged with **the version that added
`referral`**, not `originalPackageId` — same as `sponsor_pool`. That id is
`referralTypesPackageId` in `deployed.<network>.json` / `NEXT_PUBLIC_REFERRAL_TYPES_PACKAGE_ID_*`.
Without it the feature stays hidden on that network.

Tests: `apps/contracts/tests/referral_tests.move` — referral recorded + shared, self-referral, wrong
form, paid path.

## App

| Where | What |
|---|---|
| Editor → Submit button | "Referral links" switch, and "Show top referrers on the form page" (`settings.referrals`) |
| Submit page | `?ref=` read on load (`useReferral`), checked against the chain; "Invited by …" banner. Forms with referrals on also say "Submit to get your own invite link" — links are only issued after submitting (decided 2026-10-16: keeps the on-chain proof that the referrer took part). Opening your own link submits without a referral. Works in Mode A (`/f?formId=…&ref=…`) and Mode B (`?ref=` or `#/f/0x…?ref=`). |
| Submit tx | `buildSubmitTx` / `buildPaidSubmitTx` take `referrerSubmissionId` and switch to `referral::*`. Covers the wallet, sponsored-pool and paid paths. |
| Thank-you screen | Personal link + copy + "N people joined through your link" (`ReferralLinkCard`). The new Submission id is read back from the tx (`extractSubmissionId`). |
| Form page | Top-5 referrers card when the creator made it public |
| Results | Referrals tab (stats + leaderboard), "Referred by" column, `referred_by` in CSV/JSON/NDJSON/Markdown exports |

### What counts

- A referral is recorded only when someone **submits** through a link — no clicks or views are
  tracked (decided 2026-10-16; the app stays a static site with nothing off-chain).
- The leaderboard and "N people joined through your link" count **distinct people**; submissions are
  shown alongside (they differ when a form allows resubmitting). In Results each referrer row opens
  to list who they invited.
- **First touch, 30 days:** the first valid link a browser opens for a form is remembered in
  `localStorage` (`walform:referral:<formId>`, `forms/services/referral-store.ts`) and credited on any
  visit within 30 days, even through a plain link or someone else's link. A referrer opening their
  own link isn't remembered. Same browser only.

Discovery (`sui/graphql/referrals.ts :: collectFormReferrals`) scans the form's own transactions
(every submit takes `&mut Form`) and picks out `ReferralRecorded` events — cost scales with the form,
not with every referral on the network. Leaderboard math is pure (`forms/lib/referrals.ts`).

## Rollout

| Step | Command | Status |
|---|---|---|
| 1. Upgrade testnet | `SUI_NETWORK=testnet bun run contracts:upgrade --note "referral module"` | ✅ 2026-10-16, v7 `0x506b81ee…` (0.224 SUI) |
| 2. Record types package | `SUI_NETWORK=testnet bun run contracts:referral-config` | ✅ |
| 3. Enoki allowlist | add the new version to `DEFAULT_PACKAGES.testnet.walform` in `supabase/functions/sponsor-transaction/index.ts` (the two `referral::*` targets are already listed), redeploy the function | ✅ deployed; a referral submit `create` returns 200 |
| 4. e2e | `bun run packages/core/scripts/smoke-referral.ts` | ✅ 11/11 |
| 5. Mainnet | same 1–3 with `SUI_NETWORK=mainnet`, then build + deploy the site | ✅ 2026-10-16: v4 `0x221ecc1e…` (0.223 SUI), function redeployed (referral `create` → 200 on an open form), site live (`index-CPfTfHeo.js`) |

Until step 3 is deployed on a network, referral submits there fall back to wallet-paid gas.

## Limitations

- One person with many wallets can still refer themselves; allowlist / token-gated / paid forms raise
  the cost of that.
- Disabling referrals hides the link and banner but keeps already-recorded referrals visible in
  Results.
- A respondent who submits before the referral check finishes (a fraction of a second) isn't credited.
- The 30-day memory is per browser; switching device or clearing site data loses it.
