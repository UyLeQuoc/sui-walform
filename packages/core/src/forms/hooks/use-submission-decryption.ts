'use client';

import { useCallback, useState } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { sealDecryptSubmission, getSealClient } from '../../crypto';
import { useActivePackageId, useOriginalPackageId } from '../../sui/package-id';
import { decodeBodyPointer, fetchWalrusBlob } from '../../walrus';
import { useFormReviewers } from './use-form-reviewers';
import { useSealSession } from './use-seal-session';
import type { SubmissionRow } from './use-form-submissions';

export type DecryptedRow = Record<string, unknown>;

export interface UseSubmissionDecryptionResult {
  decryptedById: Record<string, DecryptedRow>;
  errorById: Record<string, string>;
  /** The submissionId currently being decrypted; null when idle. */
  pendingId: string | null;
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
  // Seal namespace stays on the original packageId (encryption identity),
  // but the moveCall target needs the CURRENT packageId — Sui upgrade
  // resolves new entry fns (like `seal_approve_read_submission_with_reviewers`)
  // only against versions where they were introduced.
  const originalPackageId = useOriginalPackageId();
  const activePackageId = useActivePackageId();
  const reviewersState = useFormReviewers(formId);

  const [decryptedById, setDecryptedById] = useState<Record<string, DecryptedRow>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  const decryptOne = useCallback(
    async (row: SubmissionRow) => {
      if (!originalPackageId || !activePackageId) return;
      setPendingId(row.submissionId);
      setErrorById((prev) => {
        if (!(row.submissionId in prev)) return prev;
        const next = { ...prev };
        delete next[row.submissionId];
        return next;
      });
      try {
        const sessionKey = await sealSession.ensureSession();
        const seal = getSealClient(suiClient);
        // If the stored body is a Walrus pointer (post-2026-05-12 submissions),
        // fetch the real Seal ciphertext from the aggregator. Legacy inline
        // ciphertexts skip this step.
        const blobId = decodeBodyPointer(row.ciphertext);
        const ciphertext = blobId ? await fetchWalrusBlob(blobId) : row.ciphertext;
        const plaintextBytes = await sealDecryptSubmission({
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
        setPendingId(null);
      }
    },
    [
      originalPackageId,
      activePackageId,
      sealSession,
      suiClient,
      formId,
      reviewersState.reviewersId,
    ],
  );

  const decryptAll = useCallback(
    async (rows: SubmissionRow[]) => {
      for (const row of rows) {
        if (decryptedById[row.submissionId]) continue;
        await decryptOne(row);
      }
    },
    [decryptedById, decryptOne],
  );

  return {
    decryptedById,
    errorById,
    pendingId,
    decryptOne,
    decryptAll,
    isSessionInitializing: sealSession.isInitializing,
  };
}
