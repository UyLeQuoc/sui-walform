# @walform/walform-site

Static Vite SPA that mounts `<FormSubmissionView>` from `@walform/core`. Built once with `vite build`, then pushed to Walrus to serve as the Mode B form host.

## Routing

The shell hash-routes: `https://<site-id>.wal.app/#/f/{formId}`. A single static bundle serves any form — the formId comes from the URL hash, not from a build-time parameter.

For local dev: `bun run dev --filter=@walform/walform-site` then open `http://localhost:3002/#/f/<formId>`.

## Deploy to Walrus

```bash
bun run build --filter=@walform/walform-site   # → dist/ (Vite output)
```

The build mirrors into `apps/builder/public/walform-site-bundle/` via `scripts/mirror-bundle.ts` so the builder's Deploy button serves the bundle inline (no per-form WAL spend). The user's connected wallet signs the `site::Site` PTB — no admin keypair needed.

### Env vars

Env vars are inherited from `apps/builder/.env` via the shared `nextPublicDefine` helper — the walform-site Vite config reuses the builder's env dir so deployed package ids / Seal / Walrus config match.

