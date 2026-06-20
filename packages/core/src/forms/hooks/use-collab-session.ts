'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';

import { reconcileSchemaIntoYDoc, seedYDocFromSchema, yDocToSchema } from '../lib/collab-schema';
import { createCollabConnection } from '../services/collab-providers';
import { useFormBuilderStore } from '../store/form-builder-store';

import type { Awareness } from 'y-protocols/awareness';
import type { CollabSessionStatus } from '../../types';

const LOCAL_ORIGIN = Symbol('walform-collab-local');
const JOIN_SYNC_TIMEOUT_MS = 8_000;

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
const NETWORK_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_COLLAB === 'true' && !!PARTYKIT_HOST && PARTYKIT_HOST.length > 0;

/**
 * Whether realtime collab can actually network (enable flag + PartyKit host set).
 * Callers gate the whole feature on this so an unconfigured build never enters
 * collab dual-mode — it just behaves like the local-only editor.
 */
export function isCollabConfigured(): boolean {
  return NETWORK_ENABLED;
}

export interface UseCollabSessionInput {
  formId: string | null;
  /** `host` seeds the doc from the local schema if empty; `join` waits for the server. */
  mode: 'host' | 'join';
  enabled: boolean;
  /** Share token (the invite-link capability); required for the network transport. */
  token: string | null;
}

export interface CollabSession {
  status: CollabSessionStatus;
  awareness: Awareness | null;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useCollabSession(input: UseCollabSessionInput): CollabSession {
  const { formId, mode, enabled, token } = input;
  const [status, setStatus] = useState<CollabSessionStatus>('idle');
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled || !formId) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const run = async () => {
      setStatus('connecting');
      const doc = new Y.Doc();
      const conn = await createCollabConnection({
        doc,
        formId,
        network: NETWORK_ENABLED && !!token,
        host: PARTYKIT_HOST,
        token: token ?? undefined,
      });
      if (disposed) {
        conn.destroy();
        doc.destroy();
        return;
      }

      const form = doc.getMap('form');
      let applyingRemote = false;

      const projectToStore = () => {
        applyingRemote = true;
        useFormBuilderStore.getState().applyRemoteSchema(yDocToSchema(doc));
        applyingRemote = false;
      };

      const startBridge = () => {
        projectToStore();
        useFormBuilderStore.getState().setCollabActive(true);

        const onDocUpdate = (_update: Uint8Array, origin: unknown) => {
          if (origin === LOCAL_ORIGIN) return;
          projectToStore();
        };
        doc.on('update', onDocUpdate);

        const unsubStore = useFormBuilderStore.subscribe((curr, prev) => {
          if (applyingRemote || curr.schema === prev.schema) return;
          doc.transact(() => reconcileSchemaIntoYDoc(doc, curr.schema), LOCAL_ORIGIN);
        });

        const undoManager = new Y.UndoManager(form, {
          trackedOrigins: new Set([LOCAL_ORIGIN]),
          captureTimeout: 800,
        });
        undoRef.current = () => undoManager.undo();
        redoRef.current = () => undoManager.redo();
        const syncUndoState = () => {
          setCanUndo(undoManager.undoStack.length > 0);
          setCanRedo(undoManager.redoStack.length > 0);
        };
        undoManager.on('stack-item-added', syncUndoState);
        undoManager.on('stack-item-popped', syncUndoState);
        undoManager.on('stack-cleared', syncUndoState);
        syncUndoState();

        setAwareness(conn.awareness);
        setStatus('synced');

        cleanup = () => {
          doc.off('update', onDocUpdate);
          unsubStore();
          undoManager.destroy();
          conn.destroy();
          doc.destroy();
          useFormBuilderStore.getState().setCollabActive(false);
          undoRef.current = () => {};
          redoRef.current = () => {};
          setCanUndo(false);
          setCanRedo(false);
        };
      };

      await conn.whenIdbSynced;
      if (disposed) {
        conn.destroy();
        doc.destroy();
        return;
      }

      if (mode === 'host') {
        if (form.size === 0) {
          const current = useFormBuilderStore.getState().schema;
          doc.transact(() => seedYDocFromSchema(doc, current));
        }
        startBridge();
        return;
      }

      // join: never seed (would clobber the host); wait for content then project.
      if (form.size > 0) {
        startBridge();
        return;
      }
      let settled = false;
      const waiters: Array<() => void> = [];
      const finish = () => {
        if (settled || disposed) return;
        settled = true;
        waiters.forEach((fn) => fn());
        startBridge();
      };
      const onUpdate = () => {
        if (form.size > 0) finish();
      };
      doc.on('update', onUpdate);
      waiters.push(() => doc.off('update', onUpdate));
      waiters.push(conn.onPeerSync(finish));
      const timer = setTimeout(finish, JOIN_SYNC_TIMEOUT_MS);
      waiters.push(() => clearTimeout(timer));
      cleanup = () => {
        waiters.forEach((fn) => fn());
        if (!settled) {
          conn.destroy();
          doc.destroy();
        }
      };
    };

    void run();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [enabled, formId, mode, token]);

  const undo = useCallback(() => undoRef.current(), []);
  const redo = useCallback(() => redoRef.current(), []);

  return useMemo(
    () => ({
      status: enabled ? status : 'idle',
      awareness,
      undo,
      redo,
      canUndo: enabled && canUndo,
      canRedo: enabled && canRedo,
    }),
    [enabled, status, awareness, undo, redo, canUndo, canRedo],
  );
}
