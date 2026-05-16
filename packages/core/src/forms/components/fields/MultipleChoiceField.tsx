'use client';

import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { cn } from '../../../lib/utils';
import { Checkbox } from '../../../ui/checkbox';
import { useFormRadius } from '../../lib/form-appearance-context';
import { PreviewField } from '../preview/PreviewField';
import type { FormField } from '../../../types';

interface MultipleChoiceFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

export function MultipleChoiceField({ field, control }: MultipleChoiceFieldProps) {
  const options = field.options ?? [];
  const radius = useFormRadius();
  const radiusStyle = radius ? { borderRadius: radius } : undefined;

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
              {options.map((opt) => {
                const checked = selected.includes(opt.value);
                return (
                  <label
                    key={opt.id}
                    htmlFor={`${field.id}-${opt.id}`}
                    style={radiusStyle}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors',
                      'group-disabled/fieldset:cursor-not-allowed group-disabled/fieldset:opacity-60',
                      checked
                        ? 'border-primary bg-primary/10 ring-primary/30 ring-1'
                        : 'border-input hover:bg-accent',
                    )}
                  >
                    <Checkbox
                      id={`${field.id}-${opt.id}`}
                      checked={checked}
                      onCheckedChange={(c) => handleChange(opt.value, c === true)}
                    />
                    <span
                      className={cn('flex-1 font-normal', checked && 'text-foreground font-medium')}
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </PreviewField>
        );
      }}
    />
  );
}
