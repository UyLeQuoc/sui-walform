'use client';

import { useSyncExternalStore } from 'react';
import {
  getSeededSubmissions,
  subscribeSeededSubmissions,
  type SeededSubmission,
} from '../services/dev-seed-submissions';

// Shared SSR snapshot — same reference every call so React doesn't see a
// "snapshot changed" between server and hydrate.
const SSR_EMPTY: SeededSubmission[] = [];

export function useSeededSubmissions(formId: string): SeededSubmission[] {
  return useSyncExternalStore(
    (cb) => subscribeSeededSubmissions(formId, cb),
    () => getSeededSubmissions(formId),
    () => SSR_EMPTY,
  );
}
