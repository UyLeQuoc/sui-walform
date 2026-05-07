'use client';

import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { Field, FieldLabel } from '../../../../ui/field';
import { ToggleGroup, ToggleGroupItem } from '../../../../ui/toggle-group';
import { useFormBuilderStore } from '../../../store/form-builder-store';
import type { FormField } from '../../../../types';

interface TextAlignToggleProps {
  field: FormField;
}

/**
 * Shared horizontal text-alignment picker used by heading and description
 * blocks. Values map directly to `FormField.textAlign`.
 */
export function TextAlignToggle({ field }: TextAlignToggleProps) {
  const updateField = useFormBuilderStore((s) => s.updateField);
  const current = field.textAlign ?? 'left';

  return (
    <Field>
      <FieldLabel>Text alignment</FieldLabel>
      <ToggleGroup
        type="single"
        variant="outline"
        value={current}
        onValueChange={(value) => {
          if (!value) return;
          updateField(field.id, {
            textAlign: value as 'left' | 'center' | 'right',
          });
        }}
        className="justify-start"
      >
        <ToggleGroupItem value="left" aria-label="Align left">
          <AlignLeft className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Align center">
          <AlignCenter className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="Align right">
          <AlignRight className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </Field>
  );
}
