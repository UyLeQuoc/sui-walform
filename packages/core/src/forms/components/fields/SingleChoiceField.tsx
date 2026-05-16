'use client';

import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { cn } from '../../../lib/utils';
import { RadioGroup, RadioGroupItem } from '../../../ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { useFormRadius } from '../../lib/form-appearance-context';
import { PreviewField } from '../preview/PreviewField';
import type { FormField } from '../../../types';

interface SingleChoiceFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

export function SingleChoiceField({ field, control }: SingleChoiceFieldProps) {
  const options = field.options ?? [];
  const radius = useFormRadius();
  const radiusStyle = radius ? { borderRadius: radius } : undefined;

  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => (
        <PreviewField field={field} error={fieldState.error?.message}>
          {field.variant === 'select' ? (
            <Select
              value={typeof rhf.value === 'string' ? rhf.value : ''}
              onValueChange={rhf.onChange}
            >
              <SelectTrigger style={radiusStyle}>
                <SelectValue placeholder={field.placeholder ?? 'Select an option'} />
              </SelectTrigger>
              <SelectContent style={radiusStyle}>
                <SelectGroup>
                  {options.map((opt) => (
                    <SelectItem key={opt.id} value={opt.value} style={radiusStyle}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <RadioGroup
              value={typeof rhf.value === 'string' ? rhf.value : ''}
              onValueChange={rhf.onChange}
              className="flex flex-col gap-2"
            >
              {options.map((opt) => {
                const checked = rhf.value === opt.value;
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
                    <RadioGroupItem value={opt.value} id={`${field.id}-${opt.id}`} />
                    <span
                      className={cn('flex-1 font-normal', checked && 'text-foreground font-medium')}
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
          )}
        </PreviewField>
      )}
    />
  );
}
