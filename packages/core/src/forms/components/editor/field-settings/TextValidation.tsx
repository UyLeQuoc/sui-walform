'use client';

import { Field, FieldLabel } from '../../../../ui/field';
import { Input } from '../../../../ui/input';
import { useFormBuilderStore } from '../../../store/form-builder-store';
import type { FormField } from '../../../../types';

interface TextValidationProps {
  field: FormField;
}

export function TextValidation({ field }: TextValidationProps) {
  const updateFieldDeferred = useFormBuilderStore((s) => s.updateFieldDeferred);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field>
        <FieldLabel htmlFor="field-min-chars">Min chars</FieldLabel>
        <Input
          id="field-min-chars"
          type="number"
          min={0}
          placeholder="e.g. 3"
          value={field.validation?.minLength ?? ''}
          onChange={(e) =>
            updateFieldDeferred(field.id, {
              validation: {
                ...field.validation,
                minLength: e.target.value === '' ? undefined : Number(e.target.value),
              },
            })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="field-max-chars">Max chars</FieldLabel>
        <Input
          id="field-max-chars"
          type="number"
          min={0}
          placeholder="e.g. 500"
          value={field.validation?.maxLength ?? ''}
          onChange={(e) =>
            updateFieldDeferred(field.id, {
              validation: {
                ...field.validation,
                maxLength: e.target.value === '' ? undefined : Number(e.target.value),
              },
            })
          }
        />
      </Field>
    </div>
  );
}
