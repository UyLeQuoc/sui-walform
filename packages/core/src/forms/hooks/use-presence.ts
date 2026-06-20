'use client';

import { useMemo, useSyncExternalStore } from 'react';

import type { Awareness } from 'y-protocols/awareness';
import type { CollabLocalState, PresencePeer } from '../../types';

const EMPTY: PresencePeer[] = [];

function collectPeers(awareness: Awareness): PresencePeer[] {
  const localId = awareness.clientID;
  const peers: PresencePeer[] = [];
  awareness.getStates().forEach((state, clientId) => {
    if (clientId === localId) return;
    const s = state as Partial<CollabLocalState>;
    if (!s.user) return;
    peers.push({
      clientId,
      user: s.user,
      selectedFieldId: s.selectedFieldId ?? null,
      cursor: s.cursor ?? null,
    });
  });
  return peers;
}

interface PresenceStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => PresencePeer[];
}

function createPresenceStore(awareness: Awareness | null): PresenceStore {
  let snapshot: PresencePeer[] = EMPTY;
  return {
    subscribe(onChange) {
      if (!awareness) return () => {};
      const handler = () => {
        snapshot = collectPeers(awareness);
        onChange();
      };
      handler();
      awareness.on('change', handler);
      return () => awareness.off('change', handler);
    },
    getSnapshot() {
      return snapshot;
    },
  };
}

/**
 * Remote collaborators derived from Yjs Awareness. Rides the Awareness external
 * store via `useSyncExternalStore` — not a second Zustand store (CODE_RULES §2).
 * Presence is ephemeral and never persisted.
 */
export function usePresence(awareness: Awareness | null): PresencePeer[] {
  const store = useMemo(() => createPresenceStore(awareness), [awareness]);
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => EMPTY,
  );
}

function focusEqual(a: PresencePeer | null, b: PresencePeer | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.clientId === b.clientId &&
    a.user.color === b.user.color &&
    a.user.address === b.user.address &&
    a.user.name === b.user.name
  );
}

function findFocusPeer(awareness: Awareness, fieldId: string): PresencePeer | null {
  const localId = awareness.clientID;
  let found: PresencePeer | null = null;
  awareness.getStates().forEach((state, clientId) => {
    if (clientId === localId || found) return;
    const s = state as Partial<CollabLocalState>;
    if (!s.user || s.selectedFieldId !== fieldId) return;
    found = { clientId, user: s.user, selectedFieldId: fieldId, cursor: null };
  });
  return found;
}

interface FocusStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => PresencePeer | null;
}

// Module-scoped factory (not inside render) so the mutable snapshot cache is
// legal under the react-compiler lint rules — mirrors createPresenceStore.
function createFocusStore(awareness: Awareness | null, fieldId: string): FocusStore {
  let snapshot: PresencePeer | null = null;
  return {
    subscribe(onChange) {
      if (!awareness) return () => {};
      const handler = () => {
        const next = findFocusPeer(awareness, fieldId);
        if (!focusEqual(next, snapshot)) {
          snapshot = next;
          onChange();
        }
      };
      handler();
      awareness.on('change', handler);
      return () => awareness.off('change', handler);
    },
    getSnapshot() {
      return snapshot;
    },
  };
}

/**
 * The remote peer (if any) currently focusing `fieldId`. Unlike `usePresence`,
 * the snapshot is held stable across unrelated Awareness churn (cursor ticks,
 * other peers' selections), so a `FieldBlock` only re-renders when *its own*
 * focus owner changes — not ~20×/s per moving cursor across every field.
 */
export function useFocusPeer(awareness: Awareness | null, fieldId: string): PresencePeer | null {
  const store = useMemo(() => createFocusStore(awareness, fieldId), [awareness, fieldId]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
}
