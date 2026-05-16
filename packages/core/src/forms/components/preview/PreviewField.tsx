'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '../../../ui/field';
import { FieldTypeIcon } from '../FieldTypeIcon';
import type { FormField } from '../../../types';

interface PreviewFieldProps {
  field: FormField;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}

/**
 * Per-field question number for the preview/runtime renderer. Provided by
 * `FormPreview` while iterating the active page's fields and consumed by
 * `PreviewField` so we don't have to thread the number through every input
 * component (ShortTextField, EmailField, …). `null` means "this field is a
 * layout block — render no number".
 */
const QuestionNumberContext = createContext<number | null>(null);

export function QuestionNumberProvider({
  value,
  children,
}: {
  value: number | null;
  children: ReactNode;
}) {
  return (
    <QuestionNumberContext.Provider value={value}>{children}</QuestionNumberContext.Provider>
  );
}

export function PreviewField({ field, error, htmlFor, children }: PreviewFieldProps) {
  const questionNumber = useContext(QuestionNumberContext);
  return (
    <Field className="px-3 py-2" data-invalid={error ? 'true' : undefined}>
      <div className="flex items-center gap-1.5">
        {questionNumber != null && (
          <span
            aria-hidden
            className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums select-none"
          >
            {questionNumber}.
          </span>
        )}
        <FieldTypeIcon
          type={field.type}
          className="text-muted-foreground/50 shrink-0"
          aria-hidden
        />
        <FieldLabel htmlFor={htmlFor} className="cursor-pointer text-sm font-medium">
          {field.label}
        </FieldLabel>
        {field.required && <span className="text-destructive shrink-0 text-sm">*</span>}
      </div>
      {field.helpText && <FieldDescription>{field.helpText}</FieldDescription>}
      <div>{children}</div>
      <FieldError>{error}</FieldError>
    </Field>
  );
}
