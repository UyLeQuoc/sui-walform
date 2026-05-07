'use client';

import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';

/**
 * Manifest emitted by `packages/walform-site/scripts/publish-to-walrus.ts`.
 * Mirrors the on-disk JSON 1:1; we don't import from there so apps/builder
 * doesn't need a workspace dep on walform-site.
 */
export interface WalrusSiteManifest {
  publishedAt: string;
  network: 'testnet' | 'mainnet';
  epochs: number;
  signer: string;
  /** URL-safe base64 form of the quilt blob — for aggregator URLs / debugging. */
  quiltBlobId: string;
  /** Same quilt blob expressed as u256 decimal. This is what `site::new_resource` takes. */
  quiltBlobIdU256: string;
  files: Array<{
    /** Site-relative path, leading slash. */
    path: string;
    /** Full base64url quilt patch id (37 bytes = blob id + internal id) — for aggregator URLs. */
    patchId: string;
    /**
     * 5-byte internal-only hex (10 chars): `version_byte + startIdx_LE_2 + endIdx_LE_2`.
     * This is what the portal's `x-wal-quilt-patch-internal-id` resource header
     * must contain — `QuiltPatch.derive_id()` reads it as hex bytes via DataView.
     * Storing the full base64 patch id here would corrupt that derivation.
     */
    quiltPatchInternalIdHex: string;
    /** Aggregator URL for the patch (debug / fallback rendering). */
    url: string;
    sizeBytes: number;
    contentType: string;
    /** SHA-256(plaintext bytes) packed as little-endian u256 decimal. */
    blobHashU256: string;
  }>;
}

/**
 * Decode a base64url string into raw bytes. Walrus patch ids use `-`/`_`
 * URL-safe alphabet without padding.
 */
export function base64UrlDecode(s: string): Uint8Array {
  const standardised = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standardised + '='.repeat((4 - (standardised.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Extract the 5-byte internal id (version + startIdx_LE + endIdx_LE) from a
 * Walrus quilt patch id. The full patch id is base64url-encoded
 * `[blobId 32B] + [internalId 5B]`. Portal needs only the 5-byte tail as
 * lower-case hex.
 */
export function quiltPatchInternalHex(fullPatchIdBase64: string): string {
  const bytes = base64UrlDecode(fullPatchIdBase64);
  if (bytes.length < 37) {
    throw new Error(
      `Quilt patch id too short (${bytes.length} bytes), expected ≥37: ${fullPatchIdBase64}`,
    );
  }
  const tail = bytes.subarray(32, 37);
  let hex = '';
  for (const b of tail) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export interface BuildCreateWalrusSiteTxInput {
  /** Walrus Sites Move package id (testnet canonical: 0x22b8c1…8dcb). */
  sitePackageId: string;
  /** Display name on the Site object. Shows in suivision + the SuiNS UI. */
  name: string;
  /** Address that will own the Site (only this address can call update_metadata). */
  recipient: string;
  manifest: WalrusSiteManifest;
}

export interface BuildDeployWalrusSiteTxInput extends BuildCreateWalrusSiteTxInput {
  /** WalForm package id — used to call `form::set_site_object_id_obj` atomically. */
  walformPackageId: string;
  /** Shared `Form` object id this site mirrors back onto. */
  formObjectId: string;
  /** `FormOwnerCap` object id authorizing the mirror call. */
  formOwnerCapId: string;
}

/**
 * Build a single PTB that creates a Walrus `site::Site` object pointing at
 * every file in `manifest`, then shares it. After the tx executes, the Site
 * object id (extractable from `objectChanges`) drives the public URL pattern
 * `https://<base36-of-site-id>.wal.app/`.
 *
 * Wire flow per-file:
 *   resource = site::new_resource(path, blob_id, blob_hash, range_none)
 *   site::add_header(resource, "content-type", contentType)
 *   site::add_header(resource, "x-wal-quilt-patch-internal-id", patchId)
 *   site::add_resource(site, resource)   // consumes resource
 *
 * `blob_id` is the **shared quilt blob** for every file (Walrus Sites stores
 * the parent blob; the portal resolves the per-file patch via the
 * `x-wal-quilt-patch-internal-id` header). `blob_hash` is the file's own
 * SHA-256 (computed by the publish script).
 *
 * Per-resource adds 3-4 commands × N files. A typical Next export hits ~20-30
 * files which fits comfortably under Sui's per-tx command limit. If the
 * bundle grows beyond ~80 files, this builder needs to chunk into multiple
 * PTBs (deferred — site-builder Rust CLI does this).
 */
/**
 * Append the metadata + new_site + per-file resource calls onto an existing
 * Transaction. Returns the `site` object handle. Caller is responsible for
 * (optionally) calling `form::set_site_object_id_obj` and ALWAYS calling
 * `transferObjects([site], recipient)` last so ownership is settled.
 */
function appendSiteCreationCalls(
  tx: Transaction,
  input: BuildCreateWalrusSiteTxInput,
): TransactionObjectArgument {
  const pkg = input.sitePackageId;

  // 1. Empty Metadata ({all none}) — Site::new_site requires it (not optional).
  const metadata = tx.moveCall({
    target: `${pkg}::metadata::new_metadata`,
    arguments: [
      tx.pure.option('string', null),
      tx.pure.option('string', null),
      tx.pure.option('string', null),
      tx.pure.option('string', null),
      tx.pure.option('string', null),
    ],
  });

  // 2. Empty site, named.
  const site = tx.moveCall({
    target: `${pkg}::site::new_site`,
    arguments: [tx.pure.string(input.name), metadata],
  });

  // 3. Per file: build a Resource, attach headers, hand it to the site.
  for (const file of input.manifest.files) {
    // Range is always None — site-builder leaves it None and relies on the
    // quilt-patch header for per-file resolution. Constructing via
    // new_range_option (vs raw option::none<Range>) is the SDK-blessed way.
    const range = tx.moveCall({
      target: `${pkg}::site::new_range_option`,
      arguments: [tx.pure.option('u64', null), tx.pure.option('u64', null)],
    });

    const resource = tx.moveCall({
      target: `${pkg}::site::new_resource`,
      arguments: [
        tx.pure.string(file.path),
        // u256 takes a decimal string (or bigint). Every file in the quilt
        // shares the same parent blob id; the portal demuxes per-file via
        // the `x-wal-quilt-patch-internal-id` header below.
        tx.pure.u256(input.manifest.quiltBlobIdU256),
        tx.pure.u256(file.blobHashU256),
        range,
      ],
    }) as unknown as TransactionObjectArgument;

    // content-encoding: identity — upstream site-builder ALWAYS adds this
    // (resource.rs L442-448). Some portal versions assume its presence; ship
    // it for byte-for-byte parity with `site-builder publish`.
    tx.moveCall({
      target: `${pkg}::site::add_header`,
      arguments: [resource, tx.pure.string('content-encoding'), tx.pure.string('identity')],
    });

    // Content-Type so the portal serves the right MIME without sniffing.
    tx.moveCall({
      target: `${pkg}::site::add_header`,
      arguments: [resource, tx.pure.string('content-type'), tx.pure.string(file.contentType)],
    });

    // Quilt-patch hint so the portal can fetch the right patch out of the
    // shared blob. Portal's QuiltPatch.derive_id() reads this as a hex
    // string of the 5-byte internal id (version + start + end indices),
    // NOT the full base64 patch id — passing the full id would parse as
    // garbage hex and resolve to the wrong slice of the blob. Upstream
    // site-builder formats this as "0x" + 10 hex chars (quilts.rs L102-123);
    // portal accepts both forms but we match upstream byte-for-byte.
    tx.moveCall({
      target: `${pkg}::site::add_header`,
      arguments: [
        resource,
        tx.pure.string('x-wal-quilt-patch-internal-id'),
        tx.pure.string(`0x${file.quiltPatchInternalIdHex}`),
      ],
    });

    // Consume the resource into the site.
    tx.moveCall({
      target: `${pkg}::site::add_resource`,
      arguments: [site, resource],
    });
  }

  return site as unknown as TransactionObjectArgument;
}

export function buildCreateWalrusSiteTx(input: BuildCreateWalrusSiteTxInput): Transaction {
  const tx = new Transaction();
  const site = appendSiteCreationCalls(tx, input);

  // Transfer to the creator. Owned (not shared) so only the creator can
  // call `update_metadata` later — sharing would leave the metadata
  // open to anyone since Walrus Sites doesn't gate `&mut Site` access.
  // Portal reads work fine on owned objects (getObject is permissionless).
  tx.transferObjects([site], input.recipient);

  return tx;
}

/**
 * Atomic version: site creation + per-file resources + form mirror in a single
 * PTB. The new `walform::form::set_site_object_id_obj<Site>(form, cap, &site)`
 * fn (added 2026-04-27 contracts upgrade) reads `object::id(site)` internally
 * so we can link the still-uncommitted Site into the Form within one tx —
 * impossible with the address variant because PTBs can't read a fresh
 * object's address as a `pure.address` arg.
 *
 * Drop pattern from upstream `site-builder publish`: site::new_site → per-file
 * resources → transfer to creator. Our addition is the mirror call BEFORE
 * transfer (transfer consumes site by-value, after which we can't reference
 * it). Borrow ordering is fine: add_resource takes `&mut Site`,
 * set_site_object_id_obj takes `&Site`, transferObjects consumes — Sui PTB
 * executor scopes borrows per-command.
 *
 * PTB size: 4N + 4 commands (4 per-file + metadata + new_site +
 * set_site_object_id_obj + transferObjects). For ~20-30 files this is well
 * under Sui's per-tx command limit.
 */
export function buildDeployWalrusSiteTx(input: BuildDeployWalrusSiteTxInput): Transaction {
  const tx = new Transaction();
  const site = appendSiteCreationCalls(tx, input);

  // Mirror the new Site's id onto the Form atomically. Generic call against
  // the walrus_sites Site type — the walform fn extracts `object::id(site)`
  // internally.
  tx.moveCall({
    target: `${input.walformPackageId}::form::set_site_object_id_obj`,
    typeArguments: [`${input.sitePackageId}::site::Site`],
    arguments: [tx.object(input.formObjectId), tx.object(input.formOwnerCapId), site],
  });

  // MUST come last — transfer consumes site by-value.
  tx.transferObjects([site], input.recipient);

  return tx;
}
