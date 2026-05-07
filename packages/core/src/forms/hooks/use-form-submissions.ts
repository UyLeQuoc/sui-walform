'use client';

import { useMemo } from 'react';
import { useSuiClientContext, useSuiClientQuery } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { useOriginalPackageId } from '../../sui/package-id';

export interface SubmissionRow {
  submissionId: string;
  formId: string;
  submitter: string;
  /** Seal ciphertext (Uint8Array). Decrypt via `sealDecryptSubmission`. */
  ciphertext: Uint8Array;
  /** 16-byte nonce — second half of the Seal identity. */
  nonce: Uint8Array;
  /** Optional Walrus blob ids for FILE_UPLOAD attachments. */
  fileBlobIds: Uint8Array[];
  submittedAtMs: number;
}

/**
 * List every Submission for a given form, sourced from chain. We use the
 * SubmissionCreated event stream as the index (events are cheap to query
 * and include submission_id), then `multiGetObjects` to pull the inline
 * ciphertext + nonce off each Submission shared object.
 *
 * Decryption is lazy — call `sealDecryptSubmission` per row when the user
 * expands it (the Seal session-key + key-server fetch is the expensive part).
 */
export function useFormSubmissions(formObjectId: string | undefined): {
  rows: SubmissionRow[];
  isLoading: boolean;
  error: Error | null;
} {
  const originalPackageId = useOriginalPackageId();
  const { network } = useSuiClientContext();

  const eventsQuery = useSuiClientQuery(
    'queryEvents',
    {
      query: originalPackageId
        ? {
            MoveEventType: `${originalPackageId}::events::SubmissionCreated`,
          }
        : ({} as never),
      order: 'descending',
      limit: 200,
    },
    { enabled: !!originalPackageId && !!formObjectId },
  );

  const submissionIds = useMemo(() => {
    if (!formObjectId) return [];
    const targetForm = normalizeSuiAddress(formObjectId);
    const events = eventsQuery.data?.data ?? [];
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const ev of events) {
      const parsed = ev.parsedJson as { form_id?: string; submission_id?: string } | undefined;
      if (!parsed?.form_id || !parsed.submission_id) continue;
      if (normalizeSuiAddress(parsed.form_id) !== targetForm) continue;
      const sid = parsed.submission_id;
      if (seen.has(sid)) continue;
      seen.add(sid);
      ids.push(sid);
    }
    return ids;
  }, [eventsQuery.data, formObjectId]);

  const objectsQuery = useSuiClientQuery(
    'multiGetObjects',
    {
      ids: submissionIds,
      options: { showContent: true, showType: true },
    },
    { enabled: submissionIds.length > 0 },
  );

  const rows = useMemo<SubmissionRow[]>(() => {
    const objects = objectsQuery.data ?? [];
    const out: SubmissionRow[] = [];
    for (const entry of objects) {
      const obj = entry.data;
      if (!obj?.objectId) continue;
      const content = obj.content as unknown as
        | {
            dataType: 'moveObject';
            fields: {
              form_id?: string;
              submitter?: string;
              encrypted_body?: number[];
              file_blob_ids?: number[][];
              nonce?: number[];
              submitted_at_ms?: string | number;
            };
          }
        | undefined;
      const fields = content?.fields;
      if (!fields) continue;
      // Skip malformed rows where ciphertext or nonce is missing — Seal
      // decrypt will throw on empty inputs anyway, and presenting them as
      // "Encrypted" rows the user can't decrypt is confusing.
      if (!fields.encrypted_body?.length || !fields.nonce?.length) continue;
      out.push({
        submissionId: obj.objectId,
        formId: fields.form_id ? normalizeSuiAddress(fields.form_id) : '',
        submitter: fields.submitter ? normalizeSuiAddress(fields.submitter) : '',
        ciphertext: new Uint8Array(fields.encrypted_body),
        nonce: new Uint8Array(fields.nonce),
        fileBlobIds: (fields.file_blob_ids ?? []).map((b) => new Uint8Array(b)),
        submittedAtMs: Number(fields.submitted_at_ms ?? 0),
      });
    }
    out.sort((a, b) => b.submittedAtMs - a.submittedAtMs);
    return out;
  }, [objectsQuery.data]);

  void network;
  return {
    rows,
    isLoading:
      (!!originalPackageId && !!formObjectId && eventsQuery.isPending) ||
      (submissionIds.length > 0 && objectsQuery.isPending),
    error: (eventsQuery.error as Error | null) ?? (objectsQuery.error as Error | null) ?? null,
  };
}
