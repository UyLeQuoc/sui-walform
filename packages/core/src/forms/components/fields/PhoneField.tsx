'use client';

import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { PhoneInput } from '../../../ui/phone-input';
import { PreviewField } from '../preview/PreviewField';
import type { FormField } from '../../../types';
import type { Value } from 'react-phone-number-input';
import type { Country } from 'react-phone-number-input';

interface PhoneFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

export function PhoneField({ field, control }: PhoneFieldProps) {
  const defaultCountry = (field.defaultCountry as Country | undefined) ?? 'US';

  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => (
        <PreviewField field={field} error={fieldState.error?.message} htmlFor={field.id}>
          <PhoneInput
            id={field.id}
            international
            defaultCountry={defaultCountry}
            value={(rhf.value as Value | undefined) ?? ''}
            onChange={(val) => rhf.onChange(val ?? '')}
            onBlur={rhf.onBlur}
            placeholder={field.placeholder ?? '+1 (555) 000-0000'}
          />
        </PreviewField>
      )}
    />
  );
}
