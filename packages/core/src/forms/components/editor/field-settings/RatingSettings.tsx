'use client';

import { Field, FieldLabel } from '../../../../ui/field';
import { Input } from '../../../../ui/input';
import { useFormBuilderStore } from '../../../store/form-builder-store';
import type { FormField } from '../../../../types';

interface RatingSettingsProps {
  field: FormField;
}

export function RatingSettings({ field }: RatingSettingsProps) {
  const updateField = useFormBuilderStore((s) => s.updateField);

  return (
    <Field>
      <FieldLabel htmlFor="rating-max">Max stars</FieldLabel>
      <Input
        id="rating-max"
        type="number"
        min={1}
        max={10}
        placeholder="e.g. 5"
        value={field.validation?.max ?? 5}
        onChange={(e) =>
          updateField(field.id, {
            validation: {
              ...field.validation,
              max: e.target.value === '' ? undefined : Number(e.target.value),
            },
          })
        }
      />
    </Field>
  );
}
