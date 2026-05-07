'use client';

import { useCallback, useMemo } from 'react';
import type { FormField } from '../../types';
import { OUTLINE_DRAG_PREFIX } from '../lib/drag-ids';
import { countOutlineKinds } from '../lib/outline';
import { useFormBuilderStore } from '../store/form-builder-store';

export interface UseOutlineResult {
  fields: FormField[];
  title: string;
  selectedFieldId: string | null;
  inputCount: number;
  sectionCount: number;
  /** Sortable ids for the outline's `SortableContext`. */
  sortableIds: string[];
  /** Select a field and scroll it into view on the canvas. */
  pickField: (id: string) => void;
}

/**
 * Reads the outline-relevant slice of the store and pre-computes the
 * counts and the sortable id list. Also exposes a `pickField` helper
 * that selects a field and scrolls its canvas counterpart into view —
 * the scroll is deferred to the next frame so the selection ring is
 * already painted by the time the smooth scroll begins.
 */
export function useOutline(): UseOutlineResult {
  const fields = useFormBuilderStore((s) => s.schema.fields);
  const title = useFormBuilderStore((s) => s.schema.title);
  const selectedFieldId = useFormBuilderStore((s) => s.selectedFieldId);
  const setSelectedFieldId = useFormBuilderStore((s) => s.setSelectedFieldId);

  const { inputs, sections } = useMemo(() => countOutlineKinds(fields), [fields]);
  const sortableIds = useMemo(() => fields.map((f) => `${OUTLINE_DRAG_PREFIX}${f.id}`), [fields]);

  const pickField = useCallback(
    (id: string) => {
      setSelectedFieldId(id);
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-field-id="${id}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
    [setSelectedFieldId],
  );

  return {
    fields,
    title,
    selectedFieldId,
    inputCount: inputs,
    sectionCount: sections,
    sortableIds,
    pickField,
  };
}
