import { bcs } from '@mysten/sui/bcs';
import type { ClientWithCoreApi } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import { blobIdToInt, type WalrusClient } from '@mysten/walrus';
import { borrow, settle, takeRelayTip } from '../sui/gen/walform/sponsor_pool';
import { nthResult } from '../sui/tx/nth-result';
import { addShareBlobs } from '../sui/tx/share-blobs';
import type { SponsorConfigState, SponsorPoolState } from '../types';

/**
 * Pool-sponsored Walrus writes where the RESPONDENT is the transaction sender
 * (and blob owner until it's shared). A form's `SponsorPool` lends the WAL for
 * storage and the SUI for the upload-relay tip; gas is covered separately by
 * whatever executes the transactions (the Enoki sponsor in the app).
 *
 * The upload relay authenticates a registration by an auth payload that must
 * be the transaction's FIRST input, so each relay-uploaded blob needs its own
 * register transaction. They are pipelined — each register tx also certifies
 * the previous blob — so N blobs cost N + 1 transactions:
 *   register(b1) → register(b2) + certify(b1) → … → certify(bN) + caller's calls
 *
 * `shared_blob::new` makes the blob extendable by anyone who funds it, so the
 * form owner can keep old submissions alive without the respondent.
 *
 * Framework-free (no React) so hooks and scripts share this exact path.
 */

export interface PreparedBlob {
  bytes: Uint8Array;
  size: number;
  blobId: string;
  rootHash: Uint8Array;
  nonce: Uint8Array;
  blobDigest: Uint8Array;
  encodingType: Awaited<
    ReturnType<WalrusClient['computeBlobMetadata']>
  >['metadata']['encodingType'];
  /** Upload-relay auth payload (blob digest ‖ sha256(nonce) ‖ u64 size). */
  authPayload: Uint8Array;
  /** Walrus attributes to set at registration (quilts are tagged for explorers). */
  attributes?: Record<string, string>;
}

export interface PreparedQuilt {
  blob: PreparedBlob;
  /** Quilt patch id per input identifier — known before registration. */
  patchIds: Map<string, string>;
}

export interface SponsorTarget {
  /** Active walform package — MoveCall target. */
  packageId: string;
  poolId: string;
  configId: string;
  formId: string;
  /** The form's allowlist, or the public dummy for non-allowlist forms. */
  allowlistId: string;
}

export interface RelayTip {
  /** Address the upload relay expects its tip at (`/v1/tip-config`). */
  address: string;
}

export interface RegisteredBlob {
  prepared: PreparedBlob;
  blobObjectId: string;
  certificate: Awaited<ReturnType<WalrusClient['writeBlobToUploadRelay']>>['certificate'];
  /** Already certified by a later blob's register transaction. */
  certified: boolean;
}

export interface SponsoredWriteDeps {
  walrus: WalrusClient;
  suiClient: ClientWithCoreApi;
  /** Signs (respondent) + executes; gas may be sponsored. */
  execute: (tx: Transaction) => Promise<{ digest: string }>;
}

const QuiltPatchIdBcs = bcs.struct('QuiltPatchId', {
  quiltId: bcs.u256(),
  patchId: bcs.struct('InternalQuiltPatchId', {
    version: bcs.u8(),
    startIndex: bcs.u16(),
    endIndex: bcs.u16(),
  }),
});

/** Same encoding as the SDK's (unexported) `encodeQuiltPatchId`. */
function quiltPatchId(quiltBlobId: string, startIndex: number, endIndex: number): string {
  const bytes = QuiltPatchIdBcs.serialize({
    quiltId: blobIdToInt(quiltBlobId),
    patchId: { version: 1, startIndex, endIndex },
  }).toBytes();
  return toBase64(bytes).replace(/=*$/, '').replaceAll('+', '-').replaceAll('/', '_');
}

export async function prepareBlob(walrus: WalrusClient, bytes: Uint8Array): Promise<PreparedBlob> {
  const meta = await walrus.computeBlobMetadata({ bytes });
  const blobDigest = await meta.blobDigest();
  // Same layout as the SDK's `addAuthPayload`, built eagerly so it can be
  // placed as input 0 synchronously.
  const nonceDigest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new Uint8Array(meta.nonce)),
  );
  const sizeBytes = bcs.u64().serialize(bytes.length).toBytes();
  const authPayload = new Uint8Array(blobDigest.length + nonceDigest.length + sizeBytes.length);
  authPayload.set(blobDigest, 0);
  authPayload.set(nonceDigest, blobDigest.length);
  authPayload.set(sizeBytes, blobDigest.length + nonceDigest.length);
  return {
    bytes,
    size: bytes.length,
    blobId: meta.blobId,
    rootHash: meta.rootHash,
    nonce: meta.nonce,
    blobDigest,
    encodingType: meta.metadata.encodingType,
    authPayload,
  };
}

export async function prepareQuilt(
  walrus: WalrusClient,
  files: { identifier: string; bytes: Uint8Array }[],
): Promise<PreparedQuilt> {
  const { quilt, index } = await walrus.encodeQuilt({
    blobs: files.map((f) => ({ contents: f.bytes, identifier: f.identifier })),
  });
  const blob = await prepareBlob(walrus, quilt);
  const patchIds = new Map(
    index.patches.map((p) => [p.identifier, quiltPatchId(blob.blobId, p.startIndex, p.endIndex)]),
  );
  return { blob: { ...blob, attributes: { _walrusBlobType: 'quilt' } }, patchIds };
}

export async function fetchRelayTip(relayHost: string): Promise<RelayTip | null> {
  const res = await fetch(`${relayHost}/v1/tip-config`);
  if (!res.ok) throw new Error(`Upload relay tip-config failed (${res.status})`);
  const json = (await res.json()) as { send_tip?: { address?: string } | null };
  const address = json.send_tip?.address;
  return address ? { address } : null;
}

/** WAL + SUI one blob's registration will draw from the pool. */
export async function sponsoredCost(
  walrus: WalrusClient,
  blob: PreparedBlob,
  epochs: number,
  relayTip: RelayTip | null,
): Promise<{ wal: bigint; tipMist: bigint }> {
  const { totalCost } = await walrus.storageCost(blob.size, epochs);
  const tipMist = relayTip ? BigInt(await walrus.calculateUploadRelayTip({ size: blob.size })) : 0n;
  return { wal: totalCost, tipMist };
}

/**
 * Why `pool` can't pay for `blobs` right now, or null if it can. Checked
 * before any transaction so the caller can fall back to wallet-paid uploads
 * without having spent anything. (Per-address quotas are enforced on-chain;
 * hitting one aborts the first transaction, which also spends nothing.)
 */
export async function sponsorshipBlocker(
  walrus: WalrusClient,
  pool: SponsorPoolState,
  config: SponsorConfigState,
  blobs: PreparedBlob[],
  epochs: number,
  relayTip: RelayTip | null,
): Promise<string | null> {
  if (!pool.enabled) return 'the creator paused sponsorship';
  const state = await walrus.systemState();
  if (
    BigInt(state.storage_price_per_unit_size) > config.maxStoragePricePerUnit ||
    BigInt(state.write_price_per_unit_size) > config.maxWritePricePerUnit
  ) {
    return 'Walrus prices are above the platform ceiling';
  }
  let wal = 0n;
  let tips = 0n;
  for (const blob of blobs) {
    const cost = await sponsoredCost(walrus, blob, epochs, relayTip);
    if (cost.wal > pool.maxWalPerUpload) return 'an upload is larger than the pool allows';
    if (cost.tipMist > pool.maxTipPerUpload) return 'the relay tip is above the pool limit';
    // borrow() reserves the worst-case fee on top of each loan.
    wal += cost.wal + (cost.wal * config.feeBps) / 10_000n;
    tips += cost.tipMist;
  }
  if (wal > pool.walFrost) return 'the pool is out of WAL';
  if (tips > pool.suiMist) return 'the pool is out of SUI for relay tips';
  return null;
}

/**
 * Adds one blob's sponsored registration to a FRESH `tx` (the relay's auth
 * payload must be input 0). The blob is transferred to `owner`, who must be
 * the transaction sender. More calls may be appended afterwards.
 */
export async function addSponsoredRegistration(
  tx: Transaction,
  walrus: WalrusClient,
  target: SponsorTarget,
  blob: PreparedBlob,
  opts: { epochs: number; owner: string; relayTip: RelayTip | null },
): Promise<void> {
  if (tx.getData().inputs.length > 0) {
    throw new Error(
      'addSponsoredRegistration needs a fresh transaction: the relay auth payload must be input 0.',
    );
  }
  if (opts.relayTip) tx.pure(blob.authPayload);
  const cost = await sponsoredCost(walrus, blob, opts.epochs, opts.relayTip);
  const borrowed = tx.add(
    borrow({
      package: target.packageId,
      arguments: {
        pool: target.poolId,
        config: target.configId,
        form: target.formId,
        allowlist: target.allowlistId,
        walAmount: cost.wal,
      },
    }),
  );
  const loan = nthResult(borrowed, 0);
  const receipt = nthResult(borrowed, 1);
  if (opts.relayTip && cost.tipMist > 0n) {
    const tip = tx.add(
      takeRelayTip({
        package: target.packageId,
        arguments: { pool: target.poolId, receipt, amount: cost.tipMist },
      }),
    );
    tx.transferObjects([tip], opts.relayTip.address);
  }
  const registered = tx.add(
    walrus.registerBlob({
      size: blob.size,
      epochs: opts.epochs,
      blobId: blob.blobId,
      rootHash: blob.rootHash,
      deletable: false,
      walCoin: loan,
      attributes: blob.attributes,
    }),
  );
  tx.add(
    settle({
      package: target.packageId,
      arguments: {
        pool: target.poolId,
        config: target.configId,
        receipt,
        blob: registered,
        leftover: loan,
      },
    }),
  );
  tx.transferObjects([registered], opts.owner);
}

/**
 * Registers and relay-uploads every blob, one sponsored transaction each, and
 * certifies each blob inside the NEXT blob's register transaction. Returns
 * every blob (only the last still uncertified): pass them all to
 * `addCertifyAndShare` in the caller's final transaction, so every SharedBlob
 * is created alongside the Submission.
 */
export async function registerSponsoredBlobs(
  deps: SponsoredWriteDeps,
  target: SponsorTarget,
  blobs: PreparedBlob[],
  opts: { epochs: number; owner: string; relayTip: RelayTip | null; signal?: AbortSignal },
): Promise<RegisteredBlob[]> {
  const { Transaction } = await import('@mysten/sui/transactions');
  const registered: RegisteredBlob[] = [];
  for (const prepared of blobs) {
    const tx = new Transaction();
    tx.setSenderIfNotSet(opts.owner);
    await addSponsoredRegistration(tx, deps.walrus, target, prepared, opts);
    const previous = registered.at(-1);
    if (previous) addCertify(tx, deps.walrus, previous);
    const { digest } = await deps.execute(tx);
    if (previous) registered[registered.length - 1] = { ...previous, certified: true };
    const blobObjectId = await createdBlobObject(deps, digest, prepared);
    const { certificate } = await deps.walrus.writeBlobToUploadRelay({
      blobId: prepared.blobId,
      blob: prepared.bytes,
      nonce: prepared.nonce,
      txDigest: digest,
      blobObjectId,
      deletable: false,
      encodingType: prepared.encodingType,
      signal: opts.signal,
    });
    registered.push({ prepared, blobObjectId, certificate, certified: false });
  }
  return registered;
}

/**
 * Final-transaction prefix: certifies whatever isn't certified yet, then shares
 * every blob as a `walrus::shared_blob::SharedBlob`. Callers append their own
 * calls (the submit) to `tx`.
 */
export async function addCertifyAndShare(
  tx: Transaction,
  walrus: WalrusClient,
  registered: RegisteredBlob[],
): Promise<void> {
  for (const r of registered) {
    if (!r.certified) addCertify(tx, walrus, r);
  }
  // Current Walrus package, same source the SDK uses for its own targets.
  const { package_id: walrusPackageId } = await walrus.systemObject();
  addShareBlobs(tx, { walrusPackageId, blobObjectIds: registered.map((r) => r.blobObjectId) });
}

function addCertify(tx: Transaction, walrus: WalrusClient, r: RegisteredBlob): void {
  tx.add(
    walrus.certifyBlob({
      blobId: r.prepared.blobId,
      blobObjectId: r.blobObjectId,
      certificate: r.certificate,
      deletable: false,
    }),
  );
}

async function createdBlobObject(
  deps: SponsoredWriteDeps,
  digest: string,
  prepared: PreparedBlob,
): Promise<string> {
  const { Transaction: TxResult, FailedTransaction } = await deps.suiClient.core.waitForTransaction(
    {
      digest,
      include: { effects: true, objectTypes: true },
    },
  );
  const result = TxResult ?? FailedTransaction;
  if (!result?.effects?.status.success) {
    throw new Error(`Sponsored registration ${digest} failed on-chain.`);
  }
  const types = result.objectTypes ?? {};
  const created = result.effects.changedObjects
    .filter((c) => c.idOperation === 'Created' && types[c.objectId]?.endsWith('::blob::Blob'))
    .map((c) => c.objectId);
  const want = blobIdToInt(prepared.blobId);
  for (const objectId of created) {
    const blob = await deps.walrus.getBlobObject(objectId);
    if (BigInt(blob.blob_id) === want) return objectId;
  }
  throw new Error(`Blob ${prepared.blobId} was not created by ${digest}.`);
}
