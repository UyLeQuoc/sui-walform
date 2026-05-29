# Walrus Sessions — Tooling Feedback Form (build spec)

The form you'll build on **walform.wal.app** to run the community feedback cycle. Dogfood: WalForm collects feedback about form tools.

## Form-level settings

| Setting | Value | Why |
| --- | --- | --- |
| Title | `Walrus Sessions — Form Tooling Feedback` | |
| Access mode | **Private (allowlist)** | Sybil resistance — only prior-session participants vote |
| Allowlist | Wallet addresses of all Session 1 + Session 2 participants | The gate. Paste the participant wallet list at publish. |
| Max submissions | unlimited (0) | One per wallet is naturally enforced; allowlist caps the pool |
| Closes at | +14 days (one cycle) | Fixed cadence — momentum dies in open-ended loops |
| Sealed schema | optional | Questions aren't secret; can leave off |
| Theme | your call | |

> **Sybil note**: the allowlist *is* the sybil defence. Each wallet on it is a verified prior participant. WalForm enforces submit gating on-chain via the Seal allowlist policy, so a non-participant literally can't submit. No off-chain identity check needed.

---

## Fields

Field types map 1:1 to WalForm's built-in types. `*` = required.

### Section A — Eligibility & context

| # | Type | Label | Notes |
| --- | --- | --- | --- |
| A1 | `heading` | **About you** | Section header |
| A2 | `single_choice` * | Which Walrus Session(s) did you participate in? | Options: `Session 1`, `Session 2`, `Both` |
| A3 | `single_choice` * | Which tool are you reviewing? | Options: the Session 2 winners + 1 community wildcard. (List the actual project names.) |
| A4 | `single_choice` * | Which perspective are you reviewing from? | Options: `End user (filling forms)`, `Admin/Creator (building forms)`, `Both` |

### Section B — End-user experience (filling a form)

| # | Type | Label | Notes |
| --- | --- | --- | --- |
| B1 | `heading` | **As someone filling out a form** | |
| B2 | `linear_scale` * | How easy was it to fill out and submit a form? | 1 = painful, 5 = effortless |
| B3 | `linear_scale` * | How clear was what was happening (wallet, gas, encryption)? | 1 = confusing, 5 = crystal clear |
| B4 | `single_choice` * | How did the number of wallet approvals feel? | Options: `Just right`, `A bit much`, `Way too many` |
| B5 | `yes_no` * | Would you use this tool as an end user? | |
| B6 | `long_text` | What confused or broke while filling the form? | Optional, free text |

### Section C — Admin / creator experience (building a form)

> Only relevant if A4 = Admin or Both — but keep visible; users self-skip.

| # | Type | Label | Notes |
| --- | --- | --- | --- |
| C1 | `heading` | **As someone building & managing forms** | |
| C2 | `linear_scale` | How easy was creating + publishing a form? | 1-5 |
| C3 | `linear_scale` | How easy was managing responses (viewing, decrypting, exporting)? | 1-5 |
| C4 | `yes_no` | Would you use this tool as an admin/creator? | |
| C5 | `long_text` | What features were missing or hard to find? | |

### Section D — Preference vote (the sybil-gated decision)

| # | Type | Label | Notes |
| --- | --- | --- | --- |
| D1 | `heading` | **Your overall preference** | |
| D2 | `single_choice` * | If you had to pick ONE tool to use end-to-end, which? | Options: same tool list as A3. **This is the vote.** |
| D3 | `long_text` * | Why that one? | Forces a reason — filters low-effort votes |

### Section E — Improvements (feeds the bounty board)

| # | Type | Label | Notes |
| --- | --- | --- | --- |
| E1 | `heading` | **What should improve** | |
| E2 | `long_text` * | Top 1-3 improvements for END USERS | |
| E3 | `long_text` | Top 1-3 improvements for ADMINS/CREATORS | |
| E4 | `long_text` | Any bug to report? Include steps to reproduce. | |
| E5 | `file` | Screenshot / screen recording of the issue (optional) | Uploads to Walrus |

### Section F — Contribution (optional)

| # | Type | Label | Notes |
| --- | --- | --- | --- |
| F1 | `heading` | **Want to help build the fix?** | |
| F2 | `yes_no` | Open to claiming a bounty / opening a PR? | |
| F3 | `short_text` | Your GitHub handle | Only if F2 = yes |
| F4 | `long_text` | Anything else? | |

---

## After collection (triage workflow)

1. **Decrypt + export CSV** from the Results dashboard (Manage → CSV export). Submissions are Seal-encrypted; only you (+ added reviewers) can read them.
2. **Add the organizers as reviewers** (Manage tab → add their wallet addresses) so they can decrypt + verify the vote independently — no "trust the winner counting their own votes".
3. **Tally D2** = the preference vote (one per gated wallet = sybil-safe).
4. **Cluster E2/E3/E4** into a public GitHub Projects board: one card per distinct improvement, split `end-user` / `admin` / `bug` columns.
5. **Promote 3-5 cards to bounties** — add acceptance criteria, value tag, `bounty` label.
6. **Retro after the 14-day window**: did contributors show up? Did the loop close once? Decide whether to run cycle 2.

---

## Why this shape

- **Two perspective tracks (B + C)** because builder taste ≠ end-user usability. Mixing them muddies both signals.
- **The vote (D2) is gated; the critique (B/C/E) is high-signal but not binding.** Vote decides direction; critique fills the backlog.
- **D3 requires a reason** so the vote isn't a one-click popularity contest.
- **E-section maps directly to bounty cards** — feedback → backlog → bounty → PR, no manual reinterpretation.
- **Reviewers = organizers** makes the tally verifiable on-chain by a neutral party.
