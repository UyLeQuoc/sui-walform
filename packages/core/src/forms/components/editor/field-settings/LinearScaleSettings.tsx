'use client';

import { Field, FieldLabel } from '../../../../ui/field';
import { Input } from '../../../../ui/input';
import { useFormBuilderStore } from '../../../store/form-builder-store';
import type { FormField } from '../../../../types';

interface LinearScaleSettingsProps {
  field: FormField;
}

export function LinearScaleSettings({ field }: LinearScaleSettingsProps) {
  const updateFieldDeferred = useFormBuilderStore((s) => s.updateFieldDeferred);

  return (
    <div className="grid grid-cols-3 gap-3">
      <Field>
        <FieldLabel htmlFor="scale-from">From</FieldLabel>
        <Input
          id="scale-from"
          type="number"
          placeholder="e.g. 1"
          value={field.validation?.scaleFrom ?? ''}
          onChange={(e) =>
            updateFieldDeferred(field.id, {
              validation: {
                ...field.validation,
                scaleFrom: e.target.value === '' ? undefined : Number(e.target.value),
              },
            })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="scale-to">To</FieldLabel>
        <Input
          id="scale-to"
          type="number"
          placeholder="e.g. 10"
          value={field.validation?.scaleTo ?? ''}
          onChange={(e) =>
            updateFieldDeferred(field.id, {
              validation: {
                ...field.validation,
                scaleTo: e.target.value === '' ? undefined : Number(e.target.value),
              },
            })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="scale-jump">Jump</FieldLabel>
        <Input
          id="scale-jump"
          type="number"
          placeholder="e.g. 1"
          value={field.validation?.scaleJump ?? ''}
          onChange={(e) =>
            updateFieldDeferred(field.id, {
              validation: {
                ...field.validation,
                scaleJump: e.target.value === '' ? undefined : Number(e.target.value),
              },
            })
          }
        />
      </Field>
    </div>
  );
}
