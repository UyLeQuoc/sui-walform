'use client';

import { Transaction } from '@mysten/sui/transactions';
import { EncryptedObject, type SealClient, type SessionKey } from '@mysten/seal';
import type { ClientWithCoreApi } from '@mysten/sui/client';
import { sealApproveReadSubmission } from '../sui/gen/walform/seal_policies';
import { buildSubmissionIdentity, generateSubmissionNonce, identityToHex } from './seal-identity';
import { getSealThreshold } from './seal-client';

/** Gate for the once-per-session "encrypted under" diagnostic in
 * `sealDecryptSubmission` — see the call site. */
let loggedSealServers = false;

export interface SealEncryptSubmissionInput {
  seal: SealClient;
  packageId: string;
  formObjectId: string;
  plaintext: Uint8Array;
}

export interface SealEncryptSubmissionOutput {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  identity: Uint8Array;
}

/**
 * Encrypt a submission body against the `seal_policies::seal_approve_read_submission`
 * policy. The caller must pass both `ciphertext` and `nonce` into the on-chain
 * `submission::submit` PTB so the on-chain identity matches the client identity.
 */
export async function sealEncryptSubmission(
  input: SealEncryptSubmissionInput,
): Promise<SealEncryptSubmissionOutput> {
  const nonce = generateSubmissionNonce();
  const identity = buildSubmissionIdentity(input.formObjectId, nonce);
  const { encryptedObject } = await input.seal.encrypt({
    threshold: getSealThreshold(),
    packageId: input.packageId,
    id: identityToHex(identity),
    data: input.plaintext,
  });
  return { ciphertext: encryptedObject, nonce, identity };
}

/**
 * Append one `seal_approve_read_submission` (or the `_with_reviewers` variant)
 * call to `tx` for a single submission. Shared by the single-row decrypt and
 * the batched `buildSealApproveBatch` so both produce identical policy calls.
 */
function appendSealApproveCall(
  tx: Transaction,
  args: {
    packageId: string;
    formObjectId: string;
    submissionObjectId: string;
    identity: Uint8Array;
    reviewersObjectId?: string;
  },
): void {
  if (args.reviewersObjectId) {
    // Raw moveCall — codegen for this fn may not exist yet on older
    // checkouts, and we already accept that the new policy entry is only
    // callable post-2026-05-13 contract upgrade.
    tx.moveCall({
      target: `${args.packageId}::seal_policies::seal_approve_read_submission_with_reviewers`,
      arguments: [
        tx.pure.vector('u8', Array.from(args.identity)),
        tx.object(args.formObjectId),
        tx.object(args.submissionObjectId),
        tx.object(args.reviewersObjectId),
      ],
    });
  } else {
    tx.add(
      sealApproveReadSubmission({
        package: args.packageId,
        arguments: {
          id: Array.from(args.identity),
          form: args.formObjectId,
          submission: args.submissionObjectId,
        },
      }),
    );
  }
}

export interface SealApproveBatchItem {
  submissionObjectId: string;
  nonce: Uint8Array;
}

export interface BuildSealApproveBatchInput {
  client: ClientWithCoreApi;
  packageId: string;
  formObjectId: string;
  items: SealApproveBatchItem[];
  reviewersObjectId?: string;
}

export interface SealApproveBatch {
  /** TransactionKind bytes covering every item's `seal_approve` call. */
  txBytes: Uint8Array;
  /** Per-item identity hex (same order as `items`) for `seal.fetchKeys`. */
  ids: string[];
}

/**
 * Build ONE `seal_approve` PTB covering every item, plus the per-item identity
 * hex ids, for a single batched `seal.fetchKeys` call. This is the key to
 * decrypting many submissions cheaply: the Seal key servers evaluate all the
 * policy calls in one request and return every key share at once, and the
 * single `tx.build` resolves all the submission objects in one `multiGetObjects`
 * — versus a per-row build + fetch that stampedes the rate-limited fullnode.
 *
 * Each submission has its OWN identity (`form.id || unique nonce`), so there is
 * no single key that unlocks all of them — but one REQUEST can fetch all the
 * per-identity keys together. Keep batches within the key server's per-PTB
 * call limit (see the caller's BATCH_SIZE).
 */
export async function buildSealApproveBatch(
  input: BuildSealApproveBatchInput,
): Promise<SealApproveBatch> {
  const tx = new Transaction();
  const ids: string[] = [];
  for (const item of input.items) {
    const identity = buildSubmissionIdentity(input.formObjectId, item.nonce);
    ids.push(identityToHex(identity));
    appendSealApproveCall(tx, {
      packageId: input.packageId,
      formObjectId: input.formObjectId,
      submissionObjectId: item.submissionObjectId,
      identity,
      reviewersObjectId: input.reviewersObjectId,
    });
  }
  const txBytes = await tx.build({ client: input.client, onlyTransactionKind: true });
  return { txBytes, ids };
}

export interface SealDecryptSubmissionInput {
  seal: SealClient;
  sessionKey: SessionKey;
  client: ClientWithCoreApi;
  packageId: string;
  formObjectId: string;
  submissionObjectId: string;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  /**
   * When set, the policy call routes through
   * `seal_approve_read_submission_with_reviewers` so addresses in the form's
   * reviewer set also pass the gate. Omit to fall back to the owner-or-
   * submitter check.
   */
  reviewersObjectId?: string;
  /**
   * Prebuilt seal_approve TransactionKind bytes from `buildSealApproveBatch`.
   * When supplied, the per-row `tx.build` is skipped — the caller is expected
   * to have already populated the SealClient key cache via `seal.fetchKeys`
   * with this same `txBytes`, so `seal.decrypt` resolves locally with no extra
   * RPC. Omit for a standalone single-row decrypt.
   */
  prebuiltTxBytes?: Uint8Array;
}

/**
 * Decrypt a submission ciphertext by building the `seal_approve_read_submission`
 * PTB and passing it as `txBytes` to `seal.decrypt`. The Seal key servers call
 * the entry function to authorize key share release; success requires the
 * caller be the form creator OR the original submitter (or — when
 * `reviewersObjectId` is supplied — a member of the form's reviewer set).
 *
 * Pass `prebuiltTxBytes` (with keys pre-fetched via `seal.fetchKeys`) to skip
 * the per-row build entirely — see `buildSealApproveBatch`.
 */
export async function sealDecryptSubmission(
  input: SealDecryptSubmissionInput,
): Promise<Uint8Array> {
  let txBytes = input.prebuiltTxBytes;
  if (!txBytes) {
    const identity = buildSubmissionIdentity(input.formObjectId, input.nonce);
    const tx = new Transaction();
    appendSealApproveCall(tx, {
      packageId: input.packageId,
      formObjectId: input.formObjectId,
      submissionObjectId: input.submissionObjectId,
      identity,
      reviewersObjectId: input.reviewersObjectId,
    });
    txBytes = await tx.build({ client: input.client, onlyTransactionKind: true });
  }
  // One-shot diagnostic: surface the ciphertext's recorded services + threshold
  // so a server-mismatch (encrypted under server A, current config = server B)
  // is obvious in the console instead of buried in a generic "Not enough shares".
  // Logged ONCE per session — it's global config (identical for every row), and
  // a 100-row "Decrypt all" would otherwise flood the console with copies.
  if (!loggedSealServers) {
    loggedSealServers = true;
    try {
      const parsed = EncryptedObject.parse(input.ciphertext);
      console.info('[seal] decrypt submission — encrypted under', {
        threshold: parsed.threshold,
        services: parsed.services.map(([objectId, share]) => ({ objectId, share })),
        packageId: parsed.packageId,
      });
    } catch (e) {
      console.warn('[seal] EncryptedObject.parse failed (legacy ciphertext?)', e);
    }
  }
  return input.seal.decrypt({
    data: input.ciphertext,
    sessionKey: input.sessionKey,
    txBytes,
  });
}
