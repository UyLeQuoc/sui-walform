'use client';

import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';

import type YPartyKitProvider from 'y-partykit/provider';
import type * as Y from 'yjs';

const PREFIX = 'walform-collab';

export function collabRoomName(formId: string): string {
  return `${PREFIX}-${formId}`;
}

export interface CollabConnection {
  awareness: Awareness;
  whenIdbSynced: Promise<void>;
  /** Subscribe to the first server sync; no-op when offline (no provider). */
  onPeerSync: (cb: () => void) => () => void;
  destroy: () => void;
}

export interface CreateCollabConnectionInput {
  doc: Y.Doc;
  formId: string;
  /** True when the PartyKit transport should be used (host + token present). */
  network: boolean;
  /** PartyKit host, e.g. `127.0.0.1:1999` or `walform-collab.<acct>.partykit.dev`. */
  host?: string;
  /** Share token (the invite-link capability); gates the room server-side. */
  token?: string;
}

/**
 * Opens a collab connection for a form's Y doc. Persistence is layered:
 *  - `y-indexeddb` is ALWAYS attached → instant local load, offline edits, and
 *    a cache that syncs up on reconnect.
 *  - When `network` is set, a `YPartyKitProvider` connects to the PartyKit room
 *    (one per form). The server holds + persists the authoritative doc, so a
 *    shared draft survives with nobody online. The token rides the WS query
 *    string (`?t=`) and the server validates it (TOFU).
 *  - When `network` is off (collab disabled or host unconfigured), the doc stays
 *    local-only with a standalone Awareness — no server contact.
 */
export async function createCollabConnection(
  input: CreateCollabConnectionInput,
): Promise<CollabConnection> {
  const { doc, formId, network, host, token } = input;
  const room = collabRoomName(formId);
  const idb = new IndexeddbPersistence(room, doc);
  const whenIdbSynced = idb.whenSynced.then(() => undefined);

  let provider: YPartyKitProvider | null = null;
  let awareness: Awareness;

  if (network && host && token) {
    const { default: YPartyKitProvider } = await import('y-partykit/provider');
    provider = new YPartyKitProvider(host, room, doc, { params: { t: token } });
    awareness = provider.awareness;
  } else {
    awareness = new Awareness(doc);
  }

  return {
    awareness,
    whenIdbSynced,
    onPeerSync(cb) {
      const p = provider;
      if (!p) return () => {};
      const handler = (isSynced: boolean) => {
        if (isSynced) cb();
      };
      p.on('synced', handler);
      return () => p.off('synced', handler);
    },
    destroy() {
      if (!provider) awareness.destroy();
      provider?.destroy();
      void idb.destroy();
    },
  };
}
