import { toast } from 'sonner';
import { dataUrlToBytes, isDataUrl, putBlob } from '../../walrus';
import { formDb } from '../services/form-db';
import type { FormSchema, StoredForm } from '../../types';

const COVER_TOAST_ID = 'publish-cover-upload';

/**
 * Drafts hold cover images as data URLs (base64) for fast offline authoring.
 * Right before publish we swap that for a Walrus aggregator URL — base64 in
 * the schema bytes blows past the contract's 100 KB schema cap on anything
 * but a tiny image, and we don't want raw image bytes in Sui storage.
 *
 * Side-effect: persists the new URL back to the IDB draft so a publish retry
 * doesn't re-upload (and so the editor stops carrying the heavy data URL).
 *
 * Returns the schema with `coverImage` rewritten to the aggregator URL, or
 * the original schema unchanged if there's nothing to upload.
 */
export async function uploadCoverImageIfNeeded(stored: StoredForm): Promise<FormSchema> {
  if (!isDataUrl(stored.schema.coverImage)) {
    return stored.schema;
  }
  toast.loading('Uploading cover image to Walrus…', { id: COVER_TOAST_ID });
  let url: string;
  try {
    const bytes = dataUrlToBytes(stored.schema.coverImage);
    const result = await putBlob(bytes, { epochs: 5 });
    url = result.url;
  } catch (err) {
    // Walrus failure aborts publish — the schema would still carry the
    // base64 cover, which blows the contract's 100 KB schema cap on
    // anything but tiny images.
    const msg = err instanceof Error ? err.message : String(err);
    toast.error(`Cover image upload failed — form not published. ${msg}`, { id: COVER_TOAST_ID });
    throw err;
  }

  const nextSchema: FormSchema = { ...stored.schema, coverImage: url };
  // Persist the new URL back to the draft so a publish retry doesn't
  // re-upload. Failure here is non-fatal: the bytes are already on Walrus
  // and `nextSchema` carries the URL the publish tx needs. We log + warn
  // but proceed so a transient IDB error doesn't block publish.
  try {
    await formDb.save({ ...stored, schema: nextSchema, updatedAt: Date.now() });
  } catch (err) {
    console.warn('[uploadCoverImageIfNeeded] IDB save after Walrus upload failed', err);
  }
  toast.success('Cover image uploaded', { id: COVER_TOAST_ID });
  return nextSchema;
}
