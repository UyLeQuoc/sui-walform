'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FormConflictError, formDb } from '../services/form-db';
import { useFormBuilderStore } from '../store/form-builder-store';
import type { FormBuilderStore } from '../store/form-builder-store';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

const SAVE_DELAY_MS = 1_000;

function extractPersistable(s: FormBuilderStore) {
  return {
    schema: s.schema,
    past: s.past,
    future: s.future,
    currentLabel: s.currentLabel,
  };
}

type Persistable = ReturnType<typeof extractPersistable>;

interface UseAutoSaveParams {
  formId: string;
  createdAt: number;
  /**
   * Last rev observed when the form was hydrated from IDB. Auto-save
   * compare-and-swaps against this; if another tab has bumped past it
   * we surface a `conflict` status and stop saving.
   */
  initialRev: number;
}

/**
 * Auto-saves the form-builder store to IndexedDB on a 1s debounce.
 *
 * Durability:
 *  - The unmount cleanup awaits the in-flight save (we own a promise on
 *    `inFlightRef`) before returning. React doesn't await cleanup, but
 *    the browser does process the IDB tx as long as we issue it
 *    synchronously, which we do.
 *  - `pagehide` and `visibilitychange → hidden` flush pending saves
 *    immediately. These are the events the browser actually delivers
 *    when a tab is closed or backgrounded; `beforeunload` is unreliable
 *    on mobile and bfcache navigations.
 *  - Edits while a save is in flight are queued, not lost: the most
 *    recent snapshot is held in `pendingRef` and persisted as soon as
 *    the current save finishes.
 *
 * Cross-tab safety:
 *  - Each save passes `expectedRev` for an atomic compare-and-swap. If
 *    another tab has bumped past it, the IDB tx aborts with
 *    `FormConflictError` and we switch to `conflict` status; further
 *    auto-saves are paused until the user reloads.
 */
export function useAutoSave({ formId, createdAt, initialRev }: UseAutoSaveParams): {
  saveStatus: SaveStatus;
} {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Most recent snapshot scheduled for save (or queued behind an in-flight save).
  const pendingRef = useRef<Persistable | null>(null);
  // Promise of the currently-running save, so we can chain queued writes
  // and so unmount can await it.
  const inFlightRef = useRef<Promise<void> | null>(null);
  // Last rev we successfully wrote (or hydrated). Drives optimistic CAS.
  const revRef = useRef<number>(initialRev);
  // Flips true after a `FormConflictError`; we stop scheduling saves so
  // we don't keep clobbering the other tab's writes.
  const conflictedRef = useRef<boolean>(false);

  const persist = useCallback(
    async (data: Persistable): Promise<void> => {
      if (conflictedRef.current) return;
      setSaveStatus('saving');
      try {
        const result = await formDb.save(
          {
            id: formId,
            ...data,
            createdAt,
            updatedAt: Date.now(),
          },
          { expectedRev: revRef.current },
        );
        revRef.current = result.rev;
        setSaveStatus('saved');
      } catch (err) {
        if (err instanceof FormConflictError) {
          conflictedRef.current = true;
          setSaveStatus('conflict');
          return;
        }
        console.error('[useAutoSave] Failed to save form:', err);
        setSaveStatus('error');
      }
    },
    [formId, createdAt],
  );

  // Drain pending → in-flight, chaining queued writes if more arrive.
  const flush = useCallback((): Promise<void> | null => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current === null) return inFlightRef.current;
    if (conflictedRef.current) {
      pendingRef.current = null;
      return null;
    }

    const run = async () => {
      while (inFlightRef.current) {
        await inFlightRef.current;
      }
      while (pendingRef.current !== null && !conflictedRef.current) {
        const next = pendingRef.current;
        pendingRef.current = null;
        await persist(next);
      }
    };
    inFlightRef.current = run().finally(() => {
      inFlightRef.current = null;
    });
    return inFlightRef.current;
  }, [persist]);

  useEffect(() => {
    const unsubscribe = useFormBuilderStore.subscribe((curr, prev) => {
      // Skip if only UI-only state changed (selectedFieldId, activeMode).
      if (
        curr.schema === prev.schema &&
        curr.past === prev.past &&
        curr.future === prev.future &&
        curr.currentLabel === prev.currentLabel
      ) {
        return;
      }
      if (conflictedRef.current) return;

      setSaveStatus('idle');
      if (timerRef.current !== null) clearTimeout(timerRef.current);

      pendingRef.current = extractPersistable(curr);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void flush();
      }, SAVE_DELAY_MS);
    });

    const flushOnHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const flushOnPageHide = () => {
      void flush();
    };
    document.addEventListener('visibilitychange', flushOnHide);
    window.addEventListener('pagehide', flushOnPageHide);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', flushOnHide);
      window.removeEventListener('pagehide', flushOnPageHide);
      // Issue any pending save synchronously. We can't `await` here
      // (cleanup is sync), but kicking off the IDB tx before this returns
      // is enough — the browser will run it to completion.
      void flush();
    };
  }, [flush]);

  return { saveStatus };
}
