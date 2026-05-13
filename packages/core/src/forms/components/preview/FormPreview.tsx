'use client';

import { Button } from '../../../ui/button';
import { cn } from '../../../lib/utils';
import { useFormPreview } from '../../hooks/use-form-preview';
import { FormAppearanceProvider } from '../../lib/form-appearance-context';
import type { FormSchema } from '../../../types';
import type { FieldValues } from 'react-hook-form';
import { PreviewFieldRenderer } from './PreviewFieldRenderer';

export interface FormPreviewProps {
  /** The form schema to render. Builder pulls this from its Zustand store;
   *  renderer (future) pulls from an on-chain Sui object. Passed as a prop
   *  so this component stays context-agnostic. */
  schema: FormSchema;
  /** Optional submit handler. If omitted, we only toast the success message
   *  and log payload (builder-preview behaviour). */
  onSubmit?: (values: FieldValues) => void | Promise<void>;
  /** Initial field values (e.g. from a Walrus-Site `#prefill=…` handoff).
   *  Merged on top of the schema-derived defaults — applied once at mount. */
  prefill?: Record<string, unknown>;
}

export function FormPreview({ schema, onSubmit, prefill }: FormPreviewProps) {
  const { form, handleSubmit } = useFormPreview({ schema, onSubmit, prefill });

  if (schema.fields.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-muted-foreground text-sm">
          No fields to preview. Switch to Edit to add fields.
        </p>
      </div>
    );
  }

  return (
    <FormAppearanceProvider borderRadiusIndex={schema.settings.borderRadius}>
      <div>
        {/* Title block — 24px horizontal inset matches field content (outer px-3 + PreviewField px-3). */}
        <div className="px-6 pt-8 pb-6">
          {schema.title && <h1 className="text-3xl leading-tight font-bold">{schema.title}</h1>}
          {schema.description && (
            <p className="text-muted-foreground mt-2 text-sm">{schema.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Field list — matches editor FormCard field wrapper padding */}
          <div className="flex flex-col px-3">
            {schema.fields.map((field) => (
              <PreviewFieldRenderer key={field.id} field={field} control={form.control} />
            ))}
          </div>

          {/* Submit — total inset matches PreviewField's (px-3 outer + px-3 inner). */}
          <div
            className={cn(
              'flex px-6 pb-8',
              schema.settings.submitAlignment === 'right' && 'justify-end',
            )}
          >
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className={cn(schema.settings.submitAlignment === 'center' && 'w-full')}
            >
              {schema.settings.submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </FormAppearanceProvider>
  );
}
