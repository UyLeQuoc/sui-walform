'use client';

import type { ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '../../../ui/field';
import { FieldTypeIcon } from '../FieldTypeIcon';
import type { FormField } from '../../../types';

interface PreviewFieldProps {
  field: FormField;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}

export function PreviewField({ field, error, htmlFor, children }: PreviewFieldProps) {
  return (
    <Field className="px-3 py-2" data-invalid={error ? 'true' : undefined}>
      <div className="flex items-center gap-1.5">
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
