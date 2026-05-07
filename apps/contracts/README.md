# @walform/contracts

Move 2024 package for WalForm + TypeScript tooling for publish / upgrade /
codegen against **Sui testnet**.

## Quick reference

```bash
# Compile + run Move unit tests
bun run test               # sui move test

# Compile only
bun run build              # sui move build

# First deploy to testnet (requires SUI_DEPLOYER_PRIVATE_KEY in .env.local)
bun run publish

# Upgrade after any Move change (preserves originalPackageId for Seal)
bun run upgrade

# Regenerate TS bindings from the current Move package
bun run codegen
```

## Env setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill `SUI_DEPLOYER_PRIVATE_KEY`. To export your active Sui CLI keypair:

```bash
sui keytool export --key-identity $(sui client active-address)
```

Paste the resulting `suiprivkey1q...` string as the value.

## What the scripts write

`scripts/publish.ts` writes `deployed.json` with:

- `packageId` — the deployed package (changes on every upgrade).
- **`originalPackageId`** — **never changes**. Seal identities are prefixed
  with this, so if it changes, previously-encrypted submissions become
  undecryptable.
- `upgradeCap`, `publisher`, `transferPolicy`, `transferPolicyCap`,
  `platformTreasury`, `platformAdminCap` — ids captured from the publish tx
  effects.

`scripts/upgrade.ts` updates `packageId` + `previousPackageId` but leaves
`originalPackageId` untouched.

## Modules

See `sources/`:

| Module | Purpose |
| --- | --- |
| `events` | Centralised event type declarations. |
| `form_owner_cap` | Capability proving ownership of a Form. |
| `form` | Form object + inline schema + settings + stats. |
| `allowlist` | Per-form allowlist for `ACCESS_ALLOWLIST` mode. |
| `payment` | Per-form treasury for `ACCESS_PAID` mode. |
| `submission` | Submission with inline Seal ciphertext. |
| `seal_policies` | `seal_approve_read_submission` + `seal_approve_submit` (whitelist pattern: creator + submitter only). |
| `template` | FormTemplate + Kiosk + global TransferPolicy with 10% platform royalty. |

See [`docs/PRD.md`](../../docs/PRD.md) §7.2 (template/royalty), §7.4
(inline storage rationale), §8 (full contract design), §9.3 (Seal scheme).
