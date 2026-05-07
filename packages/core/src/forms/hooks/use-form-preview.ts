'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { generateDefaultValues, generateZodSchema } from '../lib/schema-gen/zod';
import type { FormSchema } from '../../types';

interface UseFormPreviewParams {
  schema: FormSchema;
  /** Optional consumer-supplied submit handler. When omitted, the hook
   *  falls back to the builder-preview behaviour: console.log + toast. */
  onSubmit?: (values: FieldValues) => void | Promise<void>;
  /**
   * Pre-populate the form's `defaultValues` — typically from a handoff
   * (e.g. Walrus Site `#prefill=…`). Merged on top of the schema's natural
   * defaults so a partial prefill doesn't blank out other fields. Only
   * applied on the initial render; subsequent prop changes don't re-seed
   * the form (RHF requires `reset` for that).
   */
  prefill?: Record<string, unknown>;
}

export interface UseFormPreviewResult {
  form: UseFormReturn<FieldValues>;
  /** Wraps `form.handleSubmit` with the resolved onSubmit handler and a
   *  post-submit reset, so the preview consumer can wire it directly to
   *  `<form onSubmit={...}>`. */
  handleSubmit: ReturnType<UseFormReturn<FieldValues>['handleSubmit']>;
}

/**
 * Wires up react-hook-form for the form preview: builds a Zod schema
 * from the form's field definitions, computes default values, and
 * provides a submit handler that toasts the success message and resets
 * the form when no consumer handler is supplied.
 */
export function useFormPreview({
  schema,
  onSubmit,
  prefill,
}: UseFormPreviewParams): UseFormPreviewResult {
  const zodSchema = generateZodSchema(schema.fields);

  const form = useForm<FieldValues>({
    resolver: zodResolver(zodSchema),
    defaultValues: { ...generateDefaultValues(schema.fields), ...(prefill ?? {}) },
  });

  const submit = async (values: FieldValues) => {
    if (onSubmit) {
      await onSubmit(values);
    } else {
      console.info('Form submitted with data:', values);
      toast.success(schema.settings.successMessage);
    }
    form.reset();
  };

  return {
    form,
    handleSubmit: form.handleSubmit(submit),
  };
}
