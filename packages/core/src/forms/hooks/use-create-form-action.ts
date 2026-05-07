'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const id = await createForm();
      router.push(`/forms/${id}`);
    } catch {
      setIsCreating(false);
    }
  };

  return { isCreating, handleCreate };
}
