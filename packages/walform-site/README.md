# @walform/walform-site

Static Next.js shell that mounts `<FormSubmissionView>` from `@walform/core`. Built once with `next build` (`output: 'export'`), then pushed to Walrus to serve as the Mode B form host.

## Routing

The shell hash-routes: `https://<site-id>.wal.app/#/f/{formId}`. A single static bundle serves any form — the formId comes from the URL hash, not from a build-time parameter.

For local dev: `bun run dev --filter=@walform/walform-site` then open `http://localhost:3002/#/f/<formId>`.

## Deploy to Walrus

```bash
bun run build --filter=@walform/walform-site   # → out/
SPONSOR_ADMIN_SECRET_KEY=suiprivkey... \
  bun run --cwd packages/walform-site walrus:publish-site
```

The script (`scripts/publish-to-walrus.ts`):

1. Walks `out/` recursively.
2. Uploads all files in a single Walrus Quilt via `WalrusClient.writeFiles` signed by `SPONSOR_ADMIN_SECRET_KEY` (admin pays WAL — same key the sponsor route uses). One Sui tx + one storage reservation for the whole bundle.
3. Writes `out/walrus-manifest.json` with `quiltBlobId` (shared) and per-file `{ path, patchId, url, sizeBytes, contentType }`.
4. Aggregator URL pattern: `${aggregator}/v1/blobs/by-quilt-patch-id/{patchId}`.

**Pending — Walrus Sites integration:** the manifest is the input to the next step (creating a Sui `site::Site` object whose resources point at these blobs). That Move-call piece can either be done with the official `site-builder` CLI from `MystenLabs/walrus-sites` (consumes a similar manifest) or implemented in TS in a future iteration. Once a site object exists, `form::set_site_object_id` mirrors it onto the Form so My Forms cards can show a "View on Walrus" link.

### Env vars

- `SPONSOR_ADMIN_SECRET_KEY` (required) — bech32 `suiprivkey...` for the WAL-paying signer.
- `WALRUS_NETWORK` (default `testnet`) — `testnet` or `mainnet`.
- `WALRUS_EPOCHS` (default `5`) — storage lifetime in Walrus epochs.
- `WALRUS_AGGREGATOR_URL` (default Mysten testnet) — used for the `url` field in the manifest.
- `WALFORM_SITE_OUT_DIR` (default `out`) — override if `next build` writes elsewhere.

## Cross-origin API calls

The shell calls into the builder app's API routes for sponsored Sui txs and Walrus uploads:

- `POST /api/sponsor`
- `POST /api/sponsor/execute`
- `POST /api/walrus/upload`

Both routes CORS-allowlist `*.wal.app` (see `apps/builder/lib/sponsor/cors.ts`). The shell hard-codes the builder origin via `NEXT_PUBLIC_BUILDER_API_ORIGIN` — fall back to same-origin in dev.
