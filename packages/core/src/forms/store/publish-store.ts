'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PublishedMeta } from '../../types';

export type PublishState = 'idle' | 'publishing' | 'published' | 'error';

interface PublishStoreState {
  /** Keyed by IDB `formId`. */
  state: Record<string, PublishState>;
  /** Keyed by IDB `formId`. */
  published: Record<string, PublishedMeta>;
  setPublishState: (formId: string, state: PublishState) => void;
  setPublished: (formId: string, meta: PublishedMeta) => void;
  getPublished: (formId: string) => PublishedMeta | undefined;
  clearPublished: (formId: string) => void;
}

export const usePublishStore = create<PublishStoreState>()(
  persist(
    (set, get) => ({
      state: {},
      published: {},
      setPublishState: (id, s) => set((prev) => ({ state: { ...prev.state, [id]: s } })),
      setPublished: (id, meta) =>
        set((prev) => ({
          published: { ...prev.published, [id]: meta },
          state: { ...prev.state, [id]: 'published' },
        })),
      getPublished: (id) => get().published[id],
      clearPublished: (id) =>
        set((prev) => {
          const published = { ...prev.published };
          delete published[id];
          const state = { ...prev.state };
          delete state[id];
          return { published, state };
        }),
    }),
    {
      name: 'walform:publish',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
