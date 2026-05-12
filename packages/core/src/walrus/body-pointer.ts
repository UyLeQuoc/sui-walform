/**
 * Encoding for "the Seal ciphertext for this Submission lives on Walrus".
 * Stored in the `Submission.encrypted_body` field on Sui as a small ~48-byte
 * pointer instead of the full ciphertext, satisfying the spec requirement
 * that submissions be stored on Walrus while leaving the existing
 * `encrypted_body: vector<u8>` Move field unchanged (Sui upgrade rules
 * forbid altering struct shapes).
 *
 * Layout: `"WAL:" || utf8(blob_id_string)`. The 4-byte magic prefix makes the
 * pointer unambiguously distinguishable from a raw Seal ciphertext, which is
 * opaque binary almost certain not to start with these exact bytes
 * (probability 1 / 2^32). Legacy inline ciphertexts continue to decrypt
 * directly without any flag flip.
 */

const MAGIC = 'WAL:';

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/** Build a pointer byte array from a Walrus blob id string. */
export function encodeBodyPointer(blobId: string): Uint8Array {
  if (!blobId) throw new Error('blobId is required');
  return ENCODER.encode(MAGIC + blobId);
}

/**
 * Return the Walrus blob id if `bytes` is a WAL pointer; null otherwise.
 * The legacy path is "no pointer → bytes ARE the Seal ciphertext".
 */
export function decodeBodyPointer(bytes: Uint8Array): string | null {
  if (bytes.length <= MAGIC.length) return null;
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC.charCodeAt(i)) return null;
  }
  return DECODER.decode(bytes.subarray(MAGIC.length));
}

/** True iff the bytes carry the WAL pointer prefix. */
export function isBodyPointer(bytes: Uint8Array): boolean {
  return decodeBodyPointer(bytes) !== null;
}
