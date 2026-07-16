'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { useOriginalPackageId } from '../../sui/package-id';
import { useActiveNetwork } from '../../sui/env-network';
import { queryEventsGql, type EventsPage } from '../../sui/graphql/events';

/** Payload of `events::SubmissionCreated` (GraphQL `contents.json`). */
interface SubmissionCreatedEvent {
  form_id?: string;
  submission_id?: string;
}

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
 * SubmissionCreated event stream as the index, then `multiGetObjects` to pull
 * the inline ciphertext + nonce off each Submission shared object.
 *
 * Both RPCs cap at 50 items per call, so we PAGINATE the event query (cursor
 * loop) and BATCH multiGetObjects in chunks of 50 — otherwise a form with >50
 * responses would only ever surface the first page. Discovery is still a
 * full SubmissionCreated scan filtered client-side by form_id (no per-field
 * RPC filter); fine at hackathon scale, an indexer is the production answer.
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
  const activeNetwork = useActiveNetwork();
  const client = useSuiClient();

  const query = useQuery<SubmissionRow[]>({
    // Network-prefixed key so `invalidateChain` (invalidates the [network]
    // prefix) refreshes this after on-chain mutations.
    queryKey: [network, 'walform:all-submissions', originalPackageId, formObjectId],
    enabled: !!originalPackageId && !!formObjectId && !!activeNetwork,
    staleTime: 10_000,
    queryFn: async (): Promise<SubmissionRow[]> => {
      if (!originalPackageId || !formObjectId || !activeNetwork) return [];
      const target = normalizeSuiAddress(formObjectId);

      // 1) paginate the SubmissionCreated stream → ids for THIS form.
      const ids: string[] = [];
      const seen = new Set<string>();
      let cursor: string | null = null;
      for (let page = 0; page < 100; page++) {
        const res: EventsPage<SubmissionCreatedEvent> = await queryEventsGql<SubmissionCreatedEvent>({
          network: activeNetwork,
          eventType: `${originalPackageId}::events::SubmissionCreated`,
          order: 'descending',
          limit: 50,
          cursor,
        });
        for (const parsed of res.data) {
          if (!parsed?.form_id || !parsed.submission_id) continue;
          if (normalizeSuiAddress(parsed.form_id) !== target) continue;
          if (seen.has(parsed.submission_id)) continue;
          seen.add(parsed.submission_id);
          ids.push(parsed.submission_id);
        }
        if (!res.hasNextPage || !res.nextCursor) break;
        cursor = res.nextCursor;
      }

      // 2) fetch the Submission objects in batches of 50 (RPC cap).
      const objects: Awaited<ReturnType<typeof client.multiGetObjects>> = [];
      for (let i = 0; i < ids.length; i += 50) {
        const part = await client.multiGetObjects({
          ids: ids.slice(i, i + 50),
          options: { showContent: true, showType: true },
        });
        objects.push(...part);
      }

      // 3) decode inline ciphertext + nonce off each object.
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
        // decrypt would throw, and a non-decryptable "Encrypted" row is just
        // confusing.
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
    },
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}
