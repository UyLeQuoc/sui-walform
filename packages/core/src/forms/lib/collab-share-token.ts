import type { StoredForm } from '../../types';

/**
 * Share-token helpers for realtime collab. The token is the invite-link
 * capability: it rides the link (`?…&t=<token>`) and the PartyKit room gates
 * connections on it (trust-on-first-use — the first token presented for a room
 * becomes canonical). Minted once per form when the owner enables sharing and
 * persisted on `StoredForm.collab` so the link is reproducible.
 */

/** Mint a fresh, high-entropy share token (two UUIDs ⇒ 256 bits, URL-safe). */
export function mintShareToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
}

/** Read the form's existing share token, if it has been shared. */
export function getShareToken(form: StoredForm): string | undefined {
  return form.collab?.shareToken;
}

/**
 * Return a copy of the form with a share token, minting + stamping one if it
 * doesn't have it yet. Idempotent: a form already shared keeps its token.
 */
export function withShareToken(form: StoredForm, now: number): StoredForm {
  if (form.collab?.shareToken) return form;
  return { ...form, collab: { shareToken: mintShareToken(), sharedAt: now } };
}
