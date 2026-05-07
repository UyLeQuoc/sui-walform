'use client';

import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { Button } from '../../../ui/button';
import { PreviewField } from '../preview/PreviewField';
import type { FormField } from '../../../types';

interface LinearScaleFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

export function LinearScaleField({ field, control }: LinearScaleFieldProps) {
  const from = field.validation?.scaleFrom ?? 1;
  const to = field.validation?.scaleTo ?? 5;
  const jump = field.validation?.scaleJump ?? 1;
  const steps: number[] = [];
  for (let i = from; i <= to; i += jump) steps.push(i);

  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => (
        <PreviewField field={field} error={fieldState.error?.message}>
          <div className="flex flex-wrap gap-2">
            {steps.map((n) => (
              <Button
                key={n}
                type="button"
                variant={rhf.value === n ? 'default' : 'outline'}
                size="icon"
                onClick={() => rhf.onChange(rhf.value === n ? undefined : n)}
              >
                {n}
              </Button>
            ))}
          </div>
        </PreviewField>
      )}
    />
  );
}
