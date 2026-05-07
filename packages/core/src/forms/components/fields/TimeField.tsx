'use client';

import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { Input } from '../../../ui/input';
import { PreviewField } from '../preview/PreviewField';
import type { FormField } from '../../../types';

interface TimeFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

export function TimeField({ field, control }: TimeFieldProps) {
  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => (
        <PreviewField field={field} error={fieldState.error?.message} htmlFor={field.id}>
          <Input
            id={field.id}
            type="time"
            value={typeof rhf.value === 'string' ? rhf.value : ''}
            onChange={rhf.onChange}
            onBlur={rhf.onBlur}
            name={rhf.name}
          />
        </PreviewField>
      )}
    />
  );
}
