'use client';

import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { Checkbox } from '../../../ui/checkbox';
import { Field, FieldLabel } from '../../../ui/field';
import { PreviewField } from '../preview/PreviewField';
import type { FormField } from '../../../types';

interface MultipleChoiceFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

export function MultipleChoiceField({ field, control }: MultipleChoiceFieldProps) {
  const options = field.options ?? [];

  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => {
        const selected: string[] = Array.isArray(rhf.value) ? (rhf.value as string[]) : [];

        const handleChange = (value: string, checked: boolean) => {
          const next = checked ? [...selected, value] : selected.filter((v) => v !== value);
          rhf.onChange(next);
        };

        return (
          <PreviewField field={field} error={fieldState.error?.message}>
            <div className="flex flex-col gap-2">
              {options.map((opt) => (
                <Field key={opt.id} orientation="horizontal">
                  <Checkbox
                    id={`${field.id}-${opt.id}`}
                    checked={selected.includes(opt.value)}
                    onCheckedChange={(checked) => handleChange(opt.value, checked === true)}
                  />
                  <FieldLabel htmlFor={`${field.id}-${opt.id}`} className="font-normal">
                    {opt.label}
                  </FieldLabel>
                </Field>
              ))}
            </div>
          </PreviewField>
        );
      }}
    />
  );
}
