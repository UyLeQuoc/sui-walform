'use client';

import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { Field, FieldLabel } from '../../../ui/field';
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
              {options.map((opt) => (
                <Field key={opt.id} orientation="horizontal">
                  <RadioGroupItem value={opt.value} id={`${field.id}-${opt.id}`} />
                  <FieldLabel htmlFor={`${field.id}-${opt.id}`} className="font-normal">
                    {opt.label}
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
          )}
        </PreviewField>
      )}
    />
  );
}
