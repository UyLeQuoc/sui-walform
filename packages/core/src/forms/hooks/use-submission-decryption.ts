'use client';

import { useCallback, useState } from 'react';
import { useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
import { sealDecryptSubmission, useSealClient } from '../../crypto';
import { useActivePackageId, useOriginalPackageId } from '../../sui/package-id';
import { decodeBodyPointer, fetchWalrusBlob } from '../../walrus';
import { useFormReviewers } from './use-form-reviewers';
import { useSealSession } from './use-seal-session';
import type { SubmissionRow } from './use-form-submissions';

export type DecryptedRow = Record<string, unknown>;

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
 * `decryptAll` runs sequentially so a single failed row doesn't poison the
 * Seal session retries — and so the UI can show progress one row at a time.
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

  const decryptOne = useCallback(
    async (row: SubmissionRow) => {
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

  const decryptAll = useCallback(
    async (rows: SubmissionRow[]) => {
      // Pre-warm the Seal session FIRST so the wallet only pops one signature
      // prompt — concurrent decryptOne calls would otherwise each see
      // `sessionRef.current === null` through their own captured closures
      // (the `inFlightRef` inside useSealSession dedupes this, but doing the
      // ensureSession up-front makes the intent explicit and the failure
      // case fail fast). Then fan out via `Promise.allSettled` so a single
      // bad row doesn't poison the rest.
      try {
        await sealSession.ensureSession();
      } catch {
        // ensureSession already set its own error state; let decryptOne
        // surface the per-row error.
      }
      const todo = rows.filter((r) => !decryptedById[r.submissionId]);
      await Promise.allSettled(todo.map((row) => decryptOne(row)));
    },
    [decryptedById, decryptOne, sealSession],
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
