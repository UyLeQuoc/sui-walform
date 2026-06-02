'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formsRoute } from '../lib/routes';

interface UseCreateFormActionParams {
  /** Provided by `useForms` — creates an empty form and returns its id. */
  createForm: () => Promise<string>;
}

export interface UseCreateFormActionResult {
  isCreating: boolean;
  /** Create + navigate. The pending state stays sticky on success because
   *  the route transition unmounts this component anyway. */
  handleCreate: () => Promise<void>;
}

export function useCreateFormAction({
  createForm,
}: UseCreateFormActionParams): UseCreateFormActionResult {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const id = await createForm();
      navigate(formsRoute.edit(id));
    } catch {
      setIsCreating(false);
    }
  };

  return { isCreating, handleCreate };
}
