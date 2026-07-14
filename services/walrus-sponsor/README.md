# @walform/walrus-sponsor

Platform-funded Walrus uploads for WalForm submission files — the **platform pays
WAL** (+ relay tip + gas) so Web2 respondents never touch WAL. Node + [Hono],
deployed on **Railway** (a real container with configurable RAM, unlike a 256 MB
edge function — needed because Walrus erasure-coding expands a blob ~5–8× in
memory).

The client (`packages/core/src/walrus/sponsored-upload.ts`) POSTs file bytes; if
they fit under the cap it uses this service, otherwise it falls back to
wallet-paid upload. Same request/response contract → no client change to switch
hosts.

## Protocol

```
POST /   { network: 'testnet'|'mainnet', sender: '0x…',
           files: [{ identifier: string, bytesB64: string }] }
     →   { quiltBlobId: string, files: [{ identifier, patchId }] }
GET /health → { ok: true }
```

Non-2xx (413 over cap, 429 rate-limited, 502 walrus error, …) → the client falls
back to wallet-paid.

## Local dev

```bash
bun install                              # from repo root
cp services/walrus-sponsor/.env.example services/walrus-sponsor/.env  # fill WALRUS_SPONSOR_KEY
bun run --cwd services/walrus-sponsor dev
# → POST http://localhost:8787
```

## Deploy on Railway

1. **New Project → Deploy from GitHub repo**, pick this repo.
2. **Settings → Root Directory** = `services/walrus-sponsor`.
3. **Start command** = `npm start` (runs `tsx src/server.ts`). Railway auto-installs deps.
4. **Variables** — set everything from `.env.example`. For the key:
   - **Use a DEDICATED sponsor wallet**, not the deployer/site-owner key. This
     service is internet-facing; if its env leaks, the attacker gets whatever the
     key controls. A dedicated wallet funded with a bounded amount of WAL (e.g.
     10 WAL) limits the blast radius to that WAL — the deployer key can `update`/
     destroy the production Walrus Site and holds all its funds. Generate:
     ```
     deno eval "import {Ed25519Keypair} from 'npm:@mysten/sui@2.20.3/keypairs/ed25519'; const k=new Ed25519Keypair(); console.log('address:',k.toSuiAddress()); console.log('secret :',k.getSecretKey())"
     ```
     Fund the address with WAL + SUI, put the `secret` in `WALRUS_SPONSOR_KEY`.
   - `ALLOWED_ORIGIN=https://walform.wal.app`, plus the caps as desired.
5. **Resources** — give it **~2 GB RAM** for the 100 MiB cap (more if you raise it).
6. **Sleep mode** — `railway.json` sets `deploy.sleepApplication: true` (scale-to-zero
   when idle; the first upload after idle eats a ~few-second cold start — fine for a
   sponsor). `numReplicas: 1` keeps the in-memory rate-limit counter coherent.
7. Copy the public URL → set `NEXT_PUBLIC_WALRUS_SPONSOR_URL` in `apps/builder/.env`,
   then rebuild + redeploy the site (see `docs/HOW_TO_DEPLOY_WALRUS_SITE.md`).

**Smoke-test on testnet first** (small file, funded testnet key) before pointing
mainnet traffic at it.

## Guardrails

Origin allowlist · per-request size cap · in-memory per-wallet daily quota
(bytes + count). The in-memory quota is per-instance — if you scale to >1 replica,
move it to Redis/Postgres. Rate-limiting per wallet is best-effort (fresh wallets
are free); the size cap + daily quota bound the WAL a single actor can spend.

[Hono]: https://hono.dev
