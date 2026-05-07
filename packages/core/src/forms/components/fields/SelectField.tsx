'use client';

import { Controller, type Control, type FieldValues } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { useFormRadius } from '../../lib/form-appearance-context';
import { PreviewField } from '../preview/PreviewField';
import type { FormField } from '../../../types';

interface SelectFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

export function SelectField({ field, control }: SelectFieldProps) {
  const options = field.options ?? [];
  const radius = useFormRadius();
  const radiusStyle = radius ? { borderRadius: radius } : undefined;

  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => (
        <PreviewField field={field} error={fieldState.error?.message}>
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
        </PreviewField>
      )}
    />
  );
}
