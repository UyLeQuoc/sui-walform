'use client';

import { Field, FieldDescription, FieldLabel } from '../../../../ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { useFormBuilderStore } from '../../../store/form-builder-store';
import type { FormField } from '../../../../types';
import { TextAlignToggle } from './TextAlignToggle';

interface HeadingSettingsProps {
  field: FormField;
}

export function HeadingSettings({ field }: HeadingSettingsProps) {
  const updateField = useFormBuilderStore((s) => s.updateField);

  return (
    <>
      <Field>
        <FieldLabel>Heading level</FieldLabel>
        <FieldDescription>Edit the heading text inline on the canvas.</FieldDescription>
        <Select
          value={field.headingLevel ?? 'h2'}
          onValueChange={(v) => updateField(field.id, { headingLevel: v as 'h1' | 'h2' | 'h3' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="h1">H1 — Large</SelectItem>
            <SelectItem value="h2">H2 — Medium</SelectItem>
            <SelectItem value="h3">H3 — Small</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <TextAlignToggle field={field} />
    </>
  );
}
