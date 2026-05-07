import { normalizeSuiAddress } from '@mysten/sui/utils';

/**
 * Layout of Seal identities used by WalForm's `seal_policies.move`:
 *   bytes  0..32  = form.id_address (BCS-encoded 32-byte Sui address)
 *   bytes 32..48  = 16 random nonce bytes per submission
 *   total         = 48 bytes
 */
export const FORM_ID_BYTES = 32;
export const NONCE_BYTES = 16;
export const IDENTITY_BYTES = FORM_ID_BYTES + NONCE_BYTES;

export function addressToBytes32(addr: string): Uint8Array {
  const hex = normalizeSuiAddress(addr).slice(2);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function generateSubmissionNonce(): Uint8Array {
  const n = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(n);
  return n;
}

export function buildSubmissionIdentity(formId: string, nonce: Uint8Array): Uint8Array {
  if (nonce.length !== NONCE_BYTES) {
    throw new Error(`nonce must be ${NONCE_BYTES} bytes, got ${nonce.length}`);
  }
  const formBytes = addressToBytes32(formId);
  const out = new Uint8Array(IDENTITY_BYTES);
  out.set(formBytes, 0);
  out.set(nonce, FORM_ID_BYTES);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return (
    '0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function identityToHex(identity: Uint8Array): string {
  return bytesToHex(identity);
}
