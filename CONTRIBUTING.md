# Contributing to WalForm

WalForm is a decentralized form builder on Sui + Walrus + Seal. It won **🏆 1st place in Walrus Session 2 — Form Tooling**, and is now submitted to **Sui Overflow 2026** (<https://overflow.sui.io>) and maintained as community infrastructure: a tool the Walrus / Sui ecosystem can use and improve together.

This guide is for anyone who wants to file an issue, claim a bounty, or open a pull request.

---

## Ways to contribute

1. **Use it + report.** The highest-value contribution is real usage. Build a form on <https://walform.wal.app>, collect a response, and tell us what broke or felt clunky.
2. **Claim a bounty.** We post small, scoped bounties for specific improvements (see [Bounties](#bounties)). Comment on the issue to claim it before starting.
3. **Open a PR.** Bug fixes, field types, UX polish, docs — all welcome. See [Development](#development).
4. **Propose a feature.** Open a GitHub Discussion. Big ideas live in [`docs/SCALE_VISION.md`](docs/SCALE_VISION.md) — pick one and pitch it.

---

## Development

Prereqs: **Bun 1.3+**, **Sui CLI** (only for contract work).

```bash
git clone https://github.com/UyLeQuoc/sui-walform
cd sui-walform
bun install
bun run dev                 # builder :3000 + portal :8080
bun run typecheck           # MUST stay green before any PR
bun run lint
bun run contracts:test      # Move unit tests (40+), if touching contracts
```

Read [`CLAUDE.md`](CLAUDE.md) for the architecture map and [`docs/CODE_RULES.md`](docs/CODE_RULES.md) for the binding component/hook/state conventions. New code that conflicts with CODE_RULES is wrong even if surrounding code drifted from it.

### Workspace layout

| Path | What |
| --- | --- |
| `apps/builder` | Vite 7 SPA — landing, authoring, results, submit. Static `out/` deployed to Walrus Sites. |
| `apps/contracts` | Move 2024 package + publish/upgrade/codegen scripts. |
| `packages/core` | Shared library — UI primitives, forms code, Sui/Walrus/Seal wiring. |
| `packages/walform-site` | Mode B static Vite SPA shell deployed to Walrus per-form. |
| `apps/portal` | Vendored Walrus Sites gateway (local dev only). |

---

## Pull request checklist

Before opening a PR:

- [ ] `bun run typecheck` green across the workspace
- [ ] `bun run lint` clean (pre-existing eslint-plugin-react config bug aside)
- [ ] `bun run contracts:test` green if you touched `apps/contracts`
- [ ] One logical change per PR — don't bundle a bug fix with a refactor
- [ ] Code reads like its surroundings — match comment density, naming, idiom
- [ ] PR title in Conventional Commits form (`feat:`, `fix:`, `docs:`, `chore:`…)
- [ ] If it changes on-chain behaviour, note whether it needs a `contracts:upgrade`

A maintainer reviews + merges. We aim for a first response within a few days.

---

## Bounties

We run improvement cycles tied to the community feedback loop:

1. Community tests the tools and submits feedback (via WalForm itself — dogfood).
2. Feedback is triaged into a public board (GitHub Projects).
3. Scoped improvements become **small bounties** with a defined acceptance criterion.
4. Anyone can claim a bounty, open a PR, and get paid on merge.

**Claiming**: comment on the bounty issue ("claiming this"). One claimant at a time; if there's no PR within the stated window, it reopens.

**Settlement**: bounties settle on-chain — the pot is escrowed and released to the contributor's address when a designated reviewer marks the PR accepted. No "did I get paid?" disputes.

Bounty issues are labelled `bounty` + a value tag (`bounty:S` / `bounty:M` / `bounty:L`).

---

## Good first issues

If you're new, look for the `good-first-issue` label. Typical starters:

- New field type (follow the pattern in `packages/core/src/forms/components/fields/`)
- New form theme font / palette (`packages/core/src/forms/lib/form-{fonts,appearance}.ts`)
- Results dashboard chart for a field type that doesn't have one yet
- Docs / examples

---

## Code of conduct

Be kind, be specific, assume good faith. We're a small community building in the open. Critique the code, not the person.

---

## Questions

Open a GitHub Discussion or ping the team in the [Walrus Discord](https://discord.gg/walrusprotocol).
