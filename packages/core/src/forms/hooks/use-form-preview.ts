'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useMemo, useState, type BaseSyntheticEvent } from 'react';
import { useForm, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { normalizeSchema, DEFAULT_NAVIGATION } from '../lib/pages';
import { generateDefaultValues, generateZodSchema } from '../lib/schema-gen/zod';
import type { FormPage, FormSchema, NavigationSettings } from '../../types';

interface UseFormPreviewParams {
  schema: FormSchema;
  /** Optional consumer-supplied submit handler. When omitted, the hook
   *  falls back to the builder-preview behaviour: console.log + toast. */
  onSubmit?: (values: FieldValues) => boolean | void | Promise<boolean | void>;
  /**
   * Pre-populate the form's `defaultValues` — typically from a handoff
   * (e.g. Walrus Site `#prefill=…`). Merged on top of the schema's natural
   * defaults so a partial prefill doesn't blank out other fields. Only
   * applied on the initial render; subsequent prop changes don't re-seed
   * the form (RHF requires `reset` for that).
   */
  prefill?: Record<string, unknown>;
  /** Read-only browse mode (e.g. Marketplace template preview): page
   *  navigation skips validation so a viewer can flip through every page
   *  without filling required fields, and Back is always allowed. */
  preview?: boolean;
}

export interface UseFormPreviewResult {
  form: UseFormReturn<FieldValues>;
  /** Wraps `form.handleSubmit` with the resolved onSubmit handler and a
   *  post-submit reset, so the preview consumer can wire it directly to
   *  `<form onSubmit={...}>`. */
  handleSubmit: (e?: BaseSyntheticEvent) => Promise<void>;
  /** Pages after normalization — every form has at least one entry. */
  pages: FormPage[];
  /** Index of the page being rendered. */
  currentPageIndex: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  /** 0..1 — fraction of pages completed (including current). */
  progress: number;
  navigation: NavigationSettings;
  /** Validates current page (when sequential) and advances. No-op on last page. */
  goNext: () => Promise<void>;
  /** Steps back through navigation history. No-op when not allowed. */
  goPrevious: () => void;
  /** Page-leave validation error string, if Next was blocked. Cleared on advance. */
  pageError: string | null;
}

/**
 * Wires up react-hook-form for the form preview and page navigation.
 *
 * Single-page legacy forms degrade gracefully: `pages` collapses to one
 * implicit page, `goNext` is a no-op, and the submit path is identical
 * to the pre-feature behavior.
 */
export function useFormPreview({
  schema,
  onSubmit,
  prefill,
  preview = false,
}: UseFormPreviewParams): UseFormPreviewResult {
  const { pages, fieldsByPage, navigation } = useMemo(() => normalizeSchema(schema), [schema]);

  // Build a single all-fields Zod schema for `defaultValues` seeding only.
  // Per-page validation runs through targeted sub-schemas inside goNext.
  const allFieldsSchema = useMemo(() => generateZodSchema(schema.fields), [schema.fields]);
  const defaultValues = useMemo(
    () => ({ ...generateDefaultValues(schema.fields), ...(prefill ?? {}) }),
    [schema.fields, prefill],
  );

  const form = useForm<FieldValues>({
    resolver: zodResolver(allFieldsSchema),
    defaultValues,
  });

  const [pageHistory, setPageHistory] = useState<number[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageError, setPageError] = useState<string | null>(null);

  const safeIndex = Math.min(currentPageIndex, Math.max(0, pages.length - 1));
  const isFirstPage = safeIndex === 0;
  const isLastPage = safeIndex === pages.length - 1 || pages.length === 0;
  const progress = pages.length === 0 ? 0 : Math.min(1, (safeIndex + 1) / pages.length);

  const validateCurrentPage = useCallback(async (): Promise<boolean> => {
    const currentPage = pages[safeIndex];
    if (!currentPage) return true;
    const fields = fieldsByPage.get(currentPage.id) ?? [];
    const pageSchema = generateZodSchema(fields);
    const subset: Record<string, unknown> = {};
    for (const f of fields) subset[f.id] = form.getValues(f.id);
    const result = pageSchema.safeParse(subset);
    if (result.success) {
      for (const f of fields) form.clearErrors(f.id);
      return true;
    }
    for (const issue of result.error.issues) {
      const fieldId = String(issue.path[0] ?? '');
      if (!fieldId) continue;
      form.setError(fieldId, { type: 'manual', message: issue.message });
    }
    return false;
  }, [pages, safeIndex, fieldsByPage, form]);

  const goNext = useCallback(async () => {
    if (pages.length === 0) return;
    // Browse-only preview flips through pages without gating on validation.
    if (!preview && navigation.mode === 'sequential') {
      const ok = await validateCurrentPage();
      if (!ok) {
        setPageError('Please fix the highlighted fields before continuing.');
        return;
      }
    }
    setPageError(null);
    if (safeIndex + 1 >= pages.length) return;
    setPageHistory((prev) => [...prev, safeIndex]);
    setCurrentPageIndex(safeIndex + 1);
  }, [pages.length, safeIndex, navigation.mode, validateCurrentPage, preview]);

  const goPrevious = useCallback(() => {
    if (!preview && !navigation.allowBack) return;
    if (pageHistory.length > 0) {
      const prev = pageHistory[pageHistory.length - 1]!;
      setPageHistory((p) => p.slice(0, -1));
      setCurrentPageIndex(prev);
    } else if (safeIndex > 0) {
      setCurrentPageIndex(safeIndex - 1);
    }
    setPageError(null);
  }, [preview, navigation.allowBack, pageHistory, safeIndex]);

  const handleSubmit = useCallback(
    async (e?: BaseSyntheticEvent): Promise<void> => {
      e?.preventDefault();
      const finalValues = form.getValues();
      const fullSchema = generateZodSchema(schema.fields);
      const result = fullSchema.safeParse(finalValues);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const fieldId = String(issue.path[0] ?? '');
          if (!fieldId) continue;
          form.setError(fieldId, { type: 'manual', message: issue.message });
        }
        const offendingFieldIds = new Set(result.error.issues.map((i) => String(i.path[0] ?? '')));
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i]!;
          if (page.fieldIds.some((id) => offendingFieldIds.has(id))) {
            setCurrentPageIndex(i);
            setPageError('Some fields need attention before submitting.');
            return;
          }
        }
        return;
      }
      if (onSubmit) {
        const submitted = await onSubmit(finalValues);
        if (submitted === false) return;
      } else {
        console.info('Form submitted with data:', finalValues);
        toast.success(schema.settings.successMessage);
      }
      form.reset();
      setCurrentPageIndex(0);
      setPageHistory([]);
      setPageError(null);
    },
    [form, schema, pages, onSubmit],
  );

  return {
    form,
    handleSubmit,
    pages,
    currentPageIndex: safeIndex,
    isFirstPage,
    isLastPage,
    progress,
    navigation: { ...DEFAULT_NAVIGATION, ...navigation },
    goNext,
    goPrevious,
    pageError,
  };
}
