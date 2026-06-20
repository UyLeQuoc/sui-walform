// WalForm realtime collab server (PartyKit + y-partykit). One room per formId.
// The room's Y doc is PERSISTED in Durable Object storage (`persist: snapshot`),
// so a shared draft survives with nobody online — an invitee can open the link
// and edit even if the owner is offline. Replaces the old y-webrtc signaling
// broker (which held no document state).
//
// Access = share token in the link (`?t=<token>`), TOFU (trust-on-first-use):
// the first token presented for a room becomes canonical; later connections
// must match. Because the owner is the first to connect (they mint + share the
// link), this binds the room to the owner's token with no pre-registration.
//
// NOTE: the static `onBeforeConnect` runs in an edge worker with NO access to
// room storage, so it can only reject a *missing* token. The canonical TOFU
// check lives in the instance `onConnect`, where `this.room.storage` exists.
//
// Dev: `bun run dev` auto-starts this (turbo). Deploy: `bun run collab:deploy`.

import type * as Party from 'partykit/server';
import { onConnect } from 'y-partykit';

const TOKEN_KEY = 'shareToken';

function tokenFromUrl(url: string): string | null {
  return new URL(url).searchParams.get('t');
}

export default class CollabServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  // Cheap edge pre-check: reject connections with no token before they reach
  // the room. Cannot validate the canonical value here (no storage at the edge).
  static async onBeforeConnect(req: Party.Request): Promise<Party.Request | Response> {
    if (!tokenFromUrl(req.url)) return new Response('missing token', { status: 401 });
    return req;
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext): Promise<void> {
    const token = tokenFromUrl(ctx.request.url);
    if (!token) {
      conn.close(4401, 'missing token');
      return;
    }

    const canonical = await this.room.storage.get<string>(TOKEN_KEY);
    if (!canonical) {
      await this.room.storage.put(TOKEN_KEY, token); // first connect (owner) sets it
    } else if (canonical !== token) {
      conn.close(4403, 'forbidden');
      return;
    }

    // Hand the socket to y-partykit; it syncs + persists the room's Y doc.
    await onConnect(conn, this.room, { persist: { mode: 'snapshot' } });
  }
}
