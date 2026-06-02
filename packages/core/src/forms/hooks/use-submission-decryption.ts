'use client';

import { useCallback, useState } from 'react';
import { useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
import {
  buildSealApproveBatch,
  getSealThreshold,
  sealDecryptSubmission,
  useSealClient,
} from '../../crypto';
import { useActivePackageId, useOriginalPackageId } from '../../sui/package-id';
import { decodeBodyPointer, fetchWalrusBlob } from '../../walrus';
import { useFormReviewers } from './use-form-reviewers';
import { useSealSession } from './use-seal-session';
import type { SubmissionRow } from './use-form-submissions';

export type DecryptedRow = Record<string, unknown>;

/**
 * Max decrypts in flight at once. Each decrypt's `tx.build()` resolves the
 * submission object (and, on the first call, the `seal_approve` Move function)
 * over RPC, plus a Seal key-server fetch. Firing all of a 100-row "Decrypt
 * all" at once stampedes the public Sui fullnode, which rate-limits with HTTP
 * 429 — and a 429 response carries no CORS headers, so the browser reports it
 * as a misleading "blocked by CORS policy" error. Capping the fan-out keeps us
 * under the limit. (Point `NEXT_PUBLIC_SUI_RPC_{TESTNET,MAINNET}` at a
 * higher-limit RPC to raise the ceiling.)
 */
const DECRYPT_CONCURRENCY = 4;

/**
 * Submissions per batched `seal.fetchKeys` request. One PTB carries this many
 * `seal_approve` calls; the key servers reject PTBs with too many, so keep it
 * conservative. Each batch = ONE key-server round trip + ONE `tx.build` (which
 * resolves all the batch's submission objects in a single `multiGetObjects`).
 */
const BATCH_SIZE = 10;

/**
 * Run `worker` over `items` with at most `limit` promises in flight. `worker`
 * is expected to swallow its own errors (decryptOne records per-row errors in
 * state), so a rejected lane never aborts the rest.
 */
async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  // Pull-with-guard so the index access narrows cleanly under
  // noUncheckedIndexedAccess (items[i] is `T | undefined`); the
  // `!== undefined` loop condition narrows back to `T` in the body.
  const next = (): T | undefined => (cursor < items.length ? items[cursor++] : undefined);
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let item = next(); item !== undefined; item = next()) {
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

export interface UseSubmissionDecryptionResult {
  decryptedById: Record<string, DecryptedRow>;
  errorById: Record<string, string>;
  /** Set of submissionIds currently being decrypted. `decryptAll` fans out
   * concurrently, so this can hold many ids at once. */
  pendingIds: ReadonlySet<string>;
  decryptOne: (row: SubmissionRow) => Promise<void>;
  decryptAll: (rows: SubmissionRow[]) => Promise<void>;
  /** True while the Seal session key is initializing (first call only). */
  isSessionInitializing: boolean;
}

export interface UseSubmissionDecryptionInput {
  formId: string;
}

/**
 * Per-submission Seal decrypt with state. The session key bootstraps on the
 * first call (one signPersonalMessage prompt, cached 30 min), then every
 * subsequent decrypt is silent.
 *
 * `decryptAll` warms the session + caches on one row, then fans the rest out
 * with bounded concurrency (see `DECRYPT_CONCURRENCY`) so a large batch stays
 * under the public fullnode's rate limit instead of stampeding it.
 */
export function useSubmissionDecryption(
  input: UseSubmissionDecryptionInput,
): UseSubmissionDecryptionResult {
  const { formId } = input;
  const sealSession = useSealSession();
  const suiClient = useSuiClient();
  const seal = useSealClient();
  const { network } = useSuiClientContext();
  // Seal namespace stays on the original packageId (encryption identity),
  // but the moveCall target needs the CURRENT packageId — Sui upgrade
  // resolves new entry fns (like `seal_approve_read_submission_with_reviewers`)
  // only against versions where they were introduced.
  const originalPackageId = useOriginalPackageId();
  const activePackageId = useActivePackageId();
  const reviewersState = useFormReviewers(formId);

  const [decryptedById, setDecryptedById] = useState<Record<string, DecryptedRow>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());

  const addPending = useCallback((id: string) => {
    setPendingIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);
  const removePending = useCallback((id: string) => {
    setPendingIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Core decrypt for a single row. When `prebuiltTxBytes` is supplied (from a
  // batched `buildSealApproveBatch` + `seal.fetchKeys`), the per-row build is
  // skipped and the key is already cached, so this runs with no extra RPC.
  const decryptRow = useCallback(
    async (row: SubmissionRow, prebuiltTxBytes?: Uint8Array) => {
      if (!originalPackageId || !activePackageId || !seal) return;
      if (network !== 'testnet' && network !== 'mainnet') return;
      addPending(row.submissionId);
      setErrorById((prev) => {
        if (!(row.submissionId in prev)) return prev;
        const next = { ...prev };
        delete next[row.submissionId];
        return next;
      });
      try {
        const sessionKey = await sealSession.ensureSession();
        // If the stored body is a Walrus pointer (post-2026-05-12 submissions),
        // fetch the real Seal ciphertext from the aggregator. Legacy inline
        // ciphertexts skip this step.
        const blobId = decodeBodyPointer(row.ciphertext);
        const ciphertext = blobId ? await fetchWalrusBlob(blobId, network) : row.ciphertext;
        // Retry once on the very first decrypt — the Seal SDK lazily loads
        // key-server metadata on the first `seal.decrypt`, and a slow warmup
        // otherwise looks like "spinner stopped and nothing happened until I
        // clicked Decrypt again". The session is already created at this
        // point, so the retry does NOT trigger another wallet signature.
        const runDecrypt = () =>
          sealDecryptSubmission({
            seal,
            sessionKey,
            client: suiClient,
            // Routing target: the function may have been added in a later
            // upgrade and is only reachable through the current packageId.
            packageId: activePackageId,
            formObjectId: formId,
            submissionObjectId: row.submissionId,
            ciphertext,
            nonce: row.nonce,
            reviewersObjectId: reviewersState.reviewersId ?? undefined,
            prebuiltTxBytes,
          });
        let plaintextBytes: Uint8Array;
        try {
          plaintextBytes = await runDecrypt();
        } catch (firstErr) {
          console.warn('[seal] first decrypt failed, retrying once', firstErr);
          plaintextBytes = await runDecrypt();
        }
        const text = new TextDecoder().decode(plaintextBytes);
        let parsed: DecryptedRow;
        try {
          parsed = JSON.parse(text) as DecryptedRow;
        } catch {
          parsed = { _raw: text };
        }
        setDecryptedById((prev) => ({ ...prev, [row.submissionId]: parsed }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorById((prev) => ({ ...prev, [row.submissionId]: msg }));
      } finally {
        removePending(row.submissionId);
      }
    },
    [
      originalPackageId,
      activePackageId,
      seal,
      network,
      sealSession,
      suiClient,
      formId,
      reviewersState.reviewersId,
      addPending,
      removePending,
    ],
  );

  // Public single-row decrypt (Individual-tab dialog button). Builds its own
  // seal_approve PTB + fetches its own key.
  const decryptOne = useCallback((row: SubmissionRow) => decryptRow(row), [decryptRow]);

  const decryptAll = useCallback(
    async (rows: SubmissionRow[]) => {
      if (!originalPackageId || !activePackageId || !seal) return;
      if (network !== 'testnet' && network !== 'mainnet') return;
      // Pre-warm the Seal session FIRST so the wallet only pops one signature
      // prompt for the whole batch. ensureSession sets its own error state on
      // failure (e.g. the user rejects the signature), so just bail.
      const sessionKey = await sealSession.ensureSession().catch(() => null);
      if (!sessionKey) return;
      const todo = rows.filter((r) => !decryptedById[r.submissionId]);
      if (todo.length === 0) return;

      const threshold = getSealThreshold();
      const reviewersObjectId = reviewersState.reviewersId ?? undefined;

      // Each submission is sealed under its OWN identity (form.id || unique
      // nonce), so there's no single key that opens all of them. But one
      // `seal.fetchKeys` request fetches EVERY per-identity key in a batch at
      // once (the key servers evaluate all the seal_approve calls in one PTB),
      // and the one `tx.build` resolves all the batch's submission objects in a
      // single multiGetObjects. So N submissions cost ~N/BATCH_SIZE round trips
      // instead of N — which is what keeps the public fullnode from 429-ing.
      for (let i = 0; i < todo.length; i += BATCH_SIZE) {
        const batch = todo.slice(i, i + BATCH_SIZE);
        let batchTxBytes: Uint8Array | undefined;
        try {
          const approve = await buildSealApproveBatch({
            client: suiClient,
            packageId: activePackageId,
            formObjectId: formId,
            reviewersObjectId,
            items: batch.map((r) => ({ submissionObjectId: r.submissionId, nonce: r.nonce })),
          });
          await seal.fetchKeys({
            ids: approve.ids,
            txBytes: approve.txBytes,
            sessionKey,
            threshold,
          });
          batchTxBytes = approve.txBytes;
        } catch (err) {
          // Batched fetch failed — e.g. a row that fails the access gate poisons
          // the shared PTB, or the server rejects the batch size. Fall back to
          // per-row decrypt (each builds its own PTB + fetches its own key),
          // which isolates the offending row.
          console.warn('[seal] batched fetchKeys failed, falling back to per-row', err);
          batchTxBytes = undefined;
        }
        // With keys cached (batchTxBytes set), each decrypt is local; the
        // remaining per-row cost is only a Walrus fetch for pointer bodies.
        // Bound it anyway so the fallback (per-row build) can't stampede.
        await runWithConcurrency(batch, DECRYPT_CONCURRENCY, (row) =>
          decryptRow(row, batchTxBytes),
        );
      }
    },
    [
      originalPackageId,
      activePackageId,
      seal,
      network,
      sealSession,
      suiClient,
      formId,
      reviewersState.reviewersId,
      decryptedById,
      decryptRow,
    ],
  );

  return {
    decryptedById,
    errorById,
    pendingIds,
    decryptOne,
    decryptAll,
    isSessionInitializing: sealSession.isInitializing,
  };
}
