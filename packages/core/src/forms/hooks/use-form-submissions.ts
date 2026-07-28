'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { Submission } from '../../sui/gen/walform/submission';
import { getMoveObjects } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
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
 * SubmissionCreated event stream (GraphQL — gRPC has no event query) as the
 * index, then batch object reads over gRPC to pull the inline ciphertext +
 * nonce off each Submission shared object.
 *
 * Both sides cap at 50 items per call, so we PAGINATE the event query (cursor
 * loop) and `getMoveObjects` batches internally — otherwise a form with >50
 * responses would only ever surface the first page. Discovery is still a
 * full SubmissionCreated scan filtered client-side by form_id (no per-field
 * server filter); fine at hackathon scale, an indexer is the production answer.
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
  const client = useSuiGrpcClient();

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

      // 2) fetch + BCS-decode the Submission objects (batched internally).
      const objects = await getMoveObjects(client, Submission, ids);

      // 3) map to rows.
      const out: SubmissionRow[] = [];
      for (const obj of objects) {
        const f = obj.fields;
        // Skip malformed rows where ciphertext or nonce is missing — Seal
        // decrypt would throw, and a non-decryptable "Encrypted" row is just
        // confusing.
        if (!f.encrypted_body.length || !f.nonce.length) continue;
        out.push({
          submissionId: obj.objectId,
          formId: normalizeSuiAddress(f.form_id),
          submitter: normalizeSuiAddress(f.submitter),
          ciphertext: new Uint8Array(f.encrypted_body),
          nonce: new Uint8Array(f.nonce),
          fileBlobIds: f.file_blob_ids.map((b) => new Uint8Array(b)),
          submittedAtMs: Number(f.submitted_at_ms),
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
