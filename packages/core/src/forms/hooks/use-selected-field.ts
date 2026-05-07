'use client';

import type { FormField } from '../../types';
import { useFormBuilderStore } from '../store/form-builder-store';

export interface UseSelectedFieldResult {
  field: FormField | undefined;
  remove: () => void;
  duplicate: () => void;
  deselect: () => void;
}

/**
 * Convenience accessor for the right-sidebar properties panel: returns
 * the currently selected field plus the three actions that operate on
 * it (delete, duplicate, deselect). Centralizing the
 * "selectedFieldId → field + actions" lookup keeps the panel UI free
 * of store boilerplate and prevents the deselect-on-delete sequence
 * from drifting between callers.
 */
export function useSelectedField(): UseSelectedFieldResult {
  const fields = useFormBuilderStore((s) => s.schema.fields);
  const selectedFieldId = useFormBuilderStore((s) => s.selectedFieldId);
  const setSelectedFieldId = useFormBuilderStore((s) => s.setSelectedFieldId);
  const removeField = useFormBuilderStore((s) => s.removeField);
  const duplicateField = useFormBuilderStore((s) => s.duplicateField);

  const field = fields.find((f) => f.id === selectedFieldId);

  return {
    field,
    remove: () => {
      if (!field) return;
      removeField(field.id);
      setSelectedFieldId(null);
    },
    duplicate: () => {
      if (!field) return;
      duplicateField(field.id);
    },
    deselect: () => setSelectedFieldId(null),
  };
}
