# Upstream: MystenLabs/walrus-sites/portal (server flavor)

This directory is a **vendored + flattened copy** of the Mysten Walrus Sites
server portal. It is the gateway that resolves `{subdomain}.{our-domain}`
requests into Walrus blob fetches + Sui `Site` object lookups. Without it our
Mode B Walrus-Site form deploys can't be served from a custom domain.

## Upstream source

|              |                                            |
| ------------ | ------------------------------------------ |
| Repo         | https://github.com/MystenLabs/walrus-sites |
| Branch       | `main`                                     |
| Subdirectory | `portal/`                                  |
| Vendored on  | 2026-04-27 (server flavor)                 |
| Flattened on | 2026-04-27                                 |

## Why server (and not worker)?

We initially vendored the **worker** flavor (Cloudflare Worker + service
worker bundle). It compiled, but failed in practice on testnet sites — the
service-worker plumbing made local debugging painful and the upstream codebase
moved faster than the worker bundle could keep up. Switched to **server**
flavor (Bun HTTP) on 2026-04-27 — same `common/` library underneath, identical
on-the-wire behavior, runs locally with a single `bun --hot run index.ts`.

## What we kept from upstream

- `server/index.ts` (entry)
- `server/custom_logger.ts`
- `server/src/` (server-specific code: config, blocklist/allowlist, cookie monster)
- `server/portal-config*.yaml` (testnet/mainnet examples + active config)
- `server/.env*.example`
- `common/lib/` (shared library: BCS parsing, domain parsing, routing, Walrus fetcher)
- `common/html_templates/` (404 / hash-mismatch templates the server returns)

## What we dropped from upstream

- `worker/` — Cloudflare Worker / service-worker flavor.
- `docker/` — container assets.
- `blocklist_api/` — supporting service not required for our demo.
- Per-package `package.json` / `tsconfig.json` (merged into one at this level).

## Local flattening (2026-04-27)

Upstream ships `portal/` as a Bun workspace root containing sibling packages
`common/` and `server/`. We collapsed both into this directory:

```
BEFORE (upstream)                       AFTER (local)
portal/                                 apps/portal/
├── package.json (workspaces)           ├── package.json   (flat, merged deps)
├── common/                             ├── tsconfig.json  (merged + @lib/* alias)
│   ├── package.json                    ├── lib/           (from common/lib/)
│   ├── lib/                            │   ├── src/
│   └── html_templates/                 │   └── tests/
└── server/                             ├── html_templates/ (from common/)
    ├── package.json                    ├── index.ts        (from server/)
    ├── tsconfig.json                   ├── custom_logger.ts
    ├── index.ts                        ├── src/            (from server/)
    └── src/                            ├── portal-config.yaml
                                        └── .env, .env.*.example
```

Rewiring applied during the flatten:

1. `tsconfig.json` aliases `@lib/*` → `./lib/src/*` and
   `@templates/*` → `./html_templates/*` (was `../common/lib/src/*` upstream).
2. `package.json` merges the deps from upstream's `server` + `common`. `name`
   becomes `@walform/portal` (workspace member). `start` / `dev` scripts call
   `bun --hot run index.ts`.
3. Stale `.env.local` from the previous worker flatten was removed — the new
   `.env` uses upstream's server format (`url|retries|metric` with metric as
   an integer, not the worker's `|metricsEnabled` boolean).

## What we added locally

- `vercel.json` (kept from server upstream — already configured for Vercel deploy).
- `portal-config.yaml` configured for our testnet:
  - `original_package_id` = `0x22b8c1...8dcb` (canonical Walrus Sites testnet,
    matches `NEXT_PUBLIC_WALRUS_SITE_PACKAGE_ID` in `apps/builder/.env.local`).
  - `enable_blocklist: false`, `enable_allowlist: false` — open access for
    testnet smoke. Re-enable + wire Redis/Vercel Edge Config when going to
    public deploy.
- TS patch in `lib/src/redirects.ts:45` — narrow `display.data["walrus site
address"]` from `unknown` to `string` (Sui SDK type drift).
- TS cast in `src/url_fetcher_factory.ts` — cast `config.{rpc,aggregator}UrlList`
  to `PriorityUrl[]` (Zod 3's `.url()` infers `string | undefined` despite
  validating the value is present at runtime).
- This file.

## Running locally

```bash
bun run --cwd apps/portal dev    # bun --hot, serves :4000
```

Visit `http://<base36-of-site-id>.localhost:4000/#/f/{formId}` after deploying
a Mode B form via the builder (`/forms` → "Deploy to Walrus Site"). The
service-worker free server returns the static shell + per-form data the form
fetches at runtime from Sui + Walrus.

## Re-syncing with upstream

Because we flattened, `git subtree pull` won't work cleanly. Manual re-sync:

```bash
cd /tmp
rm -rf ws-upstream
git clone --depth 1 https://github.com/MystenLabs/walrus-sites.git ws-upstream
cd ws-upstream && git rev-parse HEAD    # record new upstream commit

WALFORM=/Users/uydev/code/WalForm/apps/portal

# Library (from common/)
rm -rf $WALFORM/lib $WALFORM/html_templates
cp -r /tmp/ws-upstream/portal/common/lib            $WALFORM/lib
cp -r /tmp/ws-upstream/portal/common/html_templates $WALFORM/html_templates

# Server (from server/)
rm -rf $WALFORM/src
cp -r /tmp/ws-upstream/portal/server/src        $WALFORM/src
cp    /tmp/ws-upstream/portal/server/index.ts   $WALFORM/index.ts
cp    /tmp/ws-upstream/portal/server/custom_logger.ts $WALFORM/custom_logger.ts
cp    /tmp/ws-upstream/portal/server/portal-config*.yaml $WALFORM/
cp    /tmp/ws-upstream/portal/server/.env.*.example $WALFORM/

# Re-apply local diffs:
#  - lib/src/redirects.ts:45 typeof guard
#  - src/url_fetcher_factory.ts PriorityUrl cast
#  - portal-config.yaml original_package_id → 0x22b8c1...8dcb
#  - .env from .env.testnet.example with the canonical package id
```

## Is portal part of the root Bun workspace?

**Yes.** `apps/portal` is a single flat workspace in the root `package.json`.
`bun install` at the repo root installs everything; `turbo run dev` and
`turbo run typecheck` drive the portal alongside builder + walform-site.
