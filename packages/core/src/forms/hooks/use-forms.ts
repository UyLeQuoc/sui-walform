/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createStoredForm } from '../lib/create-stored-form';
import { FORMS_CHANGED_EVENT, formDb } from '../services/form-db';
import type { StoredForm } from '../../types';

type FormsState =
  | { status: 'loading' }
  | { status: 'success'; data: StoredForm[] }
  | { status: 'error'; error: Error };

interface UseFormsReturn {
  forms: StoredForm[];
  isLoading: boolean;
  error: Error | null;
  createForm: () => Promise<string>;
  deleteForm: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useForms(): UseFormsReturn {
  const [state, setState] = useState<FormsState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const all = await formDb.getAll();
      all.sort((a, b) => b.updatedAt - a.updatedAt);
      setState({ status: 'success', data: all });
    } catch (err) {
      setState({
        status: 'error',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, []);

  useEffect(() => {
    void load();
    const handler = () => void load();
    if (typeof window !== 'undefined') {
      window.addEventListener(FORMS_CHANGED_EVENT, handler);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(FORMS_CHANGED_EVENT, handler);
      }
    };
  }, [load]);

  const createForm = useCallback(async (): Promise<string> => {
    const stored = createStoredForm();
    await formDb.save(stored);
    await load();
    return stored.id;
  }, [load]);

  const deleteForm = useCallback(
    async (id: string): Promise<void> => {
      await formDb.delete(id);
      await load();
    },
    [load],
  );

  return {
    forms: state.status === 'success' ? state.data : [],
    isLoading: state.status === 'loading',
    error: state.status === 'error' ? state.error : null,
    createForm,
    deleteForm,
    refetch: load,
  };
}
