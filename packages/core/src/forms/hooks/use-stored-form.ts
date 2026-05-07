'use client';

import { useEffect, useState } from 'react';
import { migrateStoredForm } from '../lib/schema-version';
import { formDb } from '../services/form-db';
import { useFormBuilderStore } from '../store/form-builder-store';
import type { StoredForm } from '../../types';

export type StoredFormLoadState =
  | { status: 'loading' }
  | { status: 'ready'; form: StoredForm }
  | { status: 'not-found' }
  | { status: 'unsupported-version'; foundVersion: number };

/**
 * Loads a form from IndexedDB by id and populates the form-builder
 * store with it. Both the editor and the preview boot from this same
 * pattern; consolidating it here keeps the loader's cancellation guard
 * and store-write order in one place.
 *
 * Runs schema-version migration before populating the store. A draft
 * stamped with a version this build doesn't understand is refused (the
 * caller can show an "unsupported version, update the app" UI) rather
 * than blindly cast.
 *
 * Consumers branch on `state.status` to render their own loading and
 * not-found UI, so this hook stays presentation-agnostic.
 */
export function useStoredForm(id: string): StoredFormLoadState {
  const loadFromDb = useFormBuilderStore((s) => s.loadFromDb);
  const [state, setState] = useState<StoredFormLoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    void formDb
      .getById(id)
      .then((stored) => {
        if (cancelled) return;
        if (!stored) {
          setState({ status: 'not-found' });
          return;
        }

        const migration = migrateStoredForm(stored);
        if (!migration.ok) {
          setState({ status: 'unsupported-version', foundVersion: migration.foundVersion });
          return;
        }

        const form = migration.form;
        // Persist the migrated record so future loads don't re-run migration
        // and other tabs see the new shape immediately. Failure here is
        // non-fatal (next load will re-migrate); just log and move on.
        if (migration.migrated) {
          formDb.save(form).catch((err) => {
            console.warn('[useStoredForm] failed to persist migrated draft', err);
          });
        }

        loadFromDb(form);
        setState({ status: 'ready', form });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[useStoredForm] IDB read failed', err);
        setState({ status: 'not-found' });
      });

    return () => {
      cancelled = true;
    };
  }, [id, loadFromDb]);

  return state;
}
