'use client';

import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { Textarea } from '../../../ui/textarea';
import { PreviewField } from '../preview/PreviewField';
import type { FormField } from '../../../types';

interface LongTextFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

export function LongTextField({ field, control }: LongTextFieldProps) {
  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => (
        <PreviewField field={field} error={fieldState.error?.message} htmlFor={field.id}>
          <Textarea
            id={field.id}
            value={rhf.value ?? ''}
            onChange={rhf.onChange}
            onBlur={rhf.onBlur}
            name={rhf.name}
            placeholder={field.placeholder ?? 'Type your answer…'}
            rows={3}
            aria-invalid={!!fieldState.error}
          />
        </PreviewField>
      )}
    />
  );
}
