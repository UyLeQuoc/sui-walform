import type { ClientWithCoreApi } from '@mysten/sui/client';
import { fromBase64, normalizeSuiAddress } from '@mysten/sui/utils';
import type { WalformNetwork } from '../sui/env-network';
import { suiGraphqlRequest } from '../sui/graphql/client';
import { getJsonObjects } from '../sui/grpc/objects';
import type { StoredBlobState } from '../types';
import { isBodyPointer } from './body-pointer';

interface CreatedObject {
  address: string;
  idCreated: boolean | null;
  outputState: {
    asMoveObject: { contents: { type: { repr: string }; json: unknown } | null } | null;
  } | null;
}

interface FormTxsPage {
  transactions: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: { effects: { objectChanges: { nodes: CreatedObject[] } } | null }[];
  };
}

// Every submit takes `&mut Form`, so filtering on the form finds each one.
const FORM_TXS = `query($form: SuiAddress!, $after: String) {
  transactions(first: 50, after: $after, filter: { affectedObject: $form }) {
    pageInfo { hasNextPage endCursor }
    nodes { effects { objectChanges(first: 50) { nodes {
      address idCreated
      outputState { asMoveObject { contents { type { repr } json } } }
    } } } }
  }
}`;

export interface FormBlobs {
  /** SharedBlobs the form's submissions created, with their current state. */
  blobs: StoredBlobState[];
  /**
   * Walrus-backed submissions with no SharedBlob — written before submissions
   * were shared, so the Blob is owned by the respondent and only they can
   * extend it.
   */
  respondentOwned: number;
}

/**
 * Every Walrus blob a form's submissions stored. A submission's SharedBlobs
 * (encrypted body, plus one quilt for attachments) are created in the same tx
 * as the Submission, so scanning the form's transactions finds them without an
 * event. Current state (end epoch, funds) is read fresh, since extensions
 * change it after creation.
 */
export async function findFormBlobs(
  client: ClientWithCoreApi,
  network: WalformNetwork,
  formId: string,
  maxPages = 100,
): Promise<FormBlobs> {
  const form = normalizeSuiAddress(formId);
  const wrappers = new Map<string, string>();
  let respondentOwned = 0;
  let after: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const res: FormTxsPage = await suiGraphqlRequest<FormTxsPage>(network, FORM_TXS, {
      form,
      after,
    });
    for (const tx of res.transactions.nodes) {
      let walrusSubmissions = 0;
      let shared = 0;
      for (const change of tx.effects?.objectChanges.nodes ?? []) {
        const contents = change.outputState?.asMoveObject?.contents;
        if (!change.idCreated || !contents) continue;
        if (contents.type.repr.endsWith('::shared_blob::SharedBlob')) {
          const inner = innerBlobId(contents.json);
          if (inner) wrappers.set(normalizeSuiAddress(change.address), inner);
          shared++;
        } else if (
          contents.type.repr.endsWith('::submission::Submission') &&
          isWalrusSubmission(contents.json, form)
        ) {
          walrusSubmissions++;
        }
      }
      if (walrusSubmissions > 0 && shared === 0) respondentOwned += walrusSubmissions;
    }
    const { hasNextPage, endCursor } = res.transactions.pageInfo;
    if (!hasNextPage || !endCursor) break;
    after = endCursor;
  }

  const current = await getJsonObjects(client, [...wrappers.keys()]);
  const blobs = current.flatMap((obj) => {
    const blobObjectId = wrappers.get(normalizeSuiAddress(obj.objectId));
    const parsed = parseSharedBlob(obj.json);
    return blobObjectId && parsed ? [{ sharedBlobId: obj.objectId, blobObjectId, ...parsed }] : [];
  });
  return { blobs, respondentOwned };
}

type Json = Record<string, unknown>;

function asObject(v: unknown): Json | null {
  return v && typeof v === 'object' ? (v as Json) : null;
}

function innerBlobId(json: unknown): string | null {
  const id = asObject(asObject(json)?.blob)?.id;
  return typeof id === 'string' ? id : null;
}

/** A submission to `form` whose body is a `WAL:` pointer (not a legacy inline ciphertext). */
function isWalrusSubmission(json: unknown, form: string): boolean {
  const root = asObject(json);
  if (typeof root?.form_id !== 'string' || normalizeSuiAddress(root.form_id) !== form) {
    return false;
  }
  // GraphQL renders `vector<u8>` as base64.
  const body = root.encrypted_body;
  if (typeof body !== 'string') return false;
  try {
    return isBodyPointer(fromBase64(body));
  } catch {
    return false;
  }
}

/** Balances render as `{ value }` or a bare string depending on the transport. */
function amount(v: unknown): bigint {
  const raw = asObject(v)?.value ?? v;
  return typeof raw === 'string' || typeof raw === 'number' ? BigInt(raw) : 0n;
}

function parseSharedBlob(
  json: unknown,
): Pick<StoredBlobState, 'encodedSize' | 'endEpoch' | 'fundsFrost'> | null {
  const root = asObject(json);
  const storage = asObject(asObject(root?.blob)?.storage);
  if (!root || !storage) return null;
  return {
    encodedSize: amount(storage.storage_size),
    endEpoch: Number(storage.end_epoch),
    fundsFrost: amount(root.funds),
  };
}
