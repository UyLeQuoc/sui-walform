'use client';

import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { cn } from '../../../lib/utils';
import { PreviewField } from '../preview/PreviewField';
import type { FormField } from '../../../types';

interface YesNoFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

export function YesNoField({ field, control }: YesNoFieldProps) {
  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => (
        <PreviewField field={field} error={fieldState.error?.message}>
          <div className="flex gap-3">
            {(['yes', 'no'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => rhf.onChange(rhf.value === option ? '' : option)}
                className={cn(
                  'flex-1 rounded-md border px-4 py-2 text-sm font-medium capitalize transition-colors',
                  rhf.value === option
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input hover:bg-accent',
                )}
              >
                {option === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </PreviewField>
      )}
    />
  );
}
