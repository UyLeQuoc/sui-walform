'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formsRoute } from '../lib/routes';
import { useForms } from './use-forms';

export interface UseCreateDraftResult {
  isCreating: boolean;
  /** Creates an empty draft, navigates to the editor, leaves `isCreating` true on
   *  success so the spinner stays during the navigation. Resets on failure. */
  createAndOpen: () => Promise<void>;
}

/**
 * One-call wrapper for the Drafts tab "New form" CTA: creates a fresh draft
 * via `useForms`, then routes to its editor. Splitting it out keeps the
 * draft creation flow testable without mounting the entire list view.
 */
export function useCreateDraft(): UseCreateDraftResult {
  const router = useRouter();
  const { createForm } = useForms();
  const [isCreating, setIsCreating] = useState(false);

  const createAndOpen = async () => {
    setIsCreating(true);
    try {
      const id = await createForm();
      router.push(formsRoute.edit(id));
    } catch {
      setIsCreating(false);
    }
  };

  return { isCreating, createAndOpen };
}
