'use client';

import { Field, FieldLabel } from '../../../../ui/field';
import { Input } from '../../../../ui/input';
import { Switch } from '../../../../ui/switch';
import { useFormBuilderStore } from '../../../store/form-builder-store';
import type { FormField } from '../../../../types';

interface CommonFieldsProps {
  field: FormField;
  placeholderHint?: string;
  showPlaceholder?: boolean;
  showDefaultText?: boolean;
}

export function CommonFields({
  field,
  placeholderHint,
  showPlaceholder = true,
  showDefaultText = false,
}: CommonFieldsProps) {
  const updateField = useFormBuilderStore((s) => s.updateField);
  const updateFieldDeferred = useFormBuilderStore((s) => s.updateFieldDeferred);

  return (
    <>
      <Field>
        <FieldLabel htmlFor="field-label">Question</FieldLabel>
        <Input
          id="field-label"
          value={field.label}
          onChange={(e) => updateFieldDeferred(field.id, { label: e.target.value })}
          placeholder="e.g. What is your name?"
        />
      </Field>

      {showPlaceholder && (
        <Field>
          <FieldLabel htmlFor="field-placeholder">Placeholder</FieldLabel>
          <Input
            id="field-placeholder"
            value={field.placeholder ?? ''}
            onChange={(e) => updateFieldDeferred(field.id, { placeholder: e.target.value })}
            placeholder={placeholderHint ?? 'e.g. Enter your answer…'}
          />
        </Field>
      )}

      {showDefaultText && (
        <Field>
          <FieldLabel htmlFor="field-default">Default value</FieldLabel>
          <Input
            id="field-default"
            type={field.type === 'number' ? 'number' : 'text'}
            value={field.defaultValue ?? ''}
            onChange={(e) =>
              updateFieldDeferred(field.id, {
                defaultValue: e.target.value || undefined,
              })
            }
            placeholder="Pre-filled value"
          />
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor="field-help">Help text</FieldLabel>
        <Input
          id="field-help"
          value={field.helpText ?? ''}
          onChange={(e) => updateFieldDeferred(field.id, { helpText: e.target.value })}
          placeholder="A short description below the label"
        />
      </Field>

      <Field orientation="horizontal">
        <FieldLabel htmlFor="field-required">Required</FieldLabel>
        <Switch
          id="field-required"
          checked={field.required}
          onCheckedChange={(checked) => updateField(field.id, { required: checked })}
        />
      </Field>
    </>
  );
}
