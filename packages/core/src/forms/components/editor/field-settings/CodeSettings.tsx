'use client';

import { Field, FieldDescription, FieldLabel } from '../../../../ui/field';
import { Input } from '../../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { CODE_LANGUAGES, DEFAULT_CODE_LANGUAGE } from '../../../lib/code-languages';
import { useFormBuilderStore } from '../../../store/form-builder-store';
import type { FormField } from '../../../../types';

interface CodeSettingsProps {
  field: FormField;
}

/**
 * Settings for the `code` field — language and optional max-chars / max-lines
 * validators. The two limits are independent and can both be applied.
 */
export function CodeSettings({ field }: CodeSettingsProps) {
  const updateField = useFormBuilderStore((s) => s.updateField);
  const updateFieldDeferred = useFormBuilderStore((s) => s.updateFieldDeferred);

  const setValidation = (
    updates: Partial<NonNullable<FormField['validation']>>,
    deferred = false,
  ) => {
    const next = { ...(field.validation ?? {}), ...updates };
    if (deferred) {
      updateFieldDeferred(field.id, { validation: next });
    } else {
      updateField(field.id, { validation: next });
    }
  };

  return (
    <>
      <Field>
        <FieldLabel>Language</FieldLabel>
        <FieldDescription>Syntax highlighting applied in preview mode.</FieldDescription>
        <Select
          value={field.codeLanguage ?? DEFAULT_CODE_LANGUAGE}
          onValueChange={(value) => updateField(field.id, { codeLanguage: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CODE_LANGUAGES.map((lang) => (
              <SelectItem key={lang.key} value={lang.key}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="code-max-chars">Max characters</FieldLabel>
        <FieldDescription>Leave empty for no limit.</FieldDescription>
        <Input
          id="code-max-chars"
          type="number"
          min={1}
          value={field.validation?.maxLength ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            const parsed = raw === '' ? undefined : Number(raw);
            setValidation(
              {
                maxLength: parsed === undefined || Number.isNaN(parsed) ? undefined : parsed,
              },
              true,
            );
          }}
          placeholder="e.g. 2000"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="code-max-lines">Max lines</FieldLabel>
        <FieldDescription>Leave empty for no limit.</FieldDescription>
        <Input
          id="code-max-lines"
          type="number"
          min={1}
          value={field.validation?.maxLines ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            const parsed = raw === '' ? undefined : Number(raw);
            setValidation(
              {
                maxLines: parsed === undefined || Number.isNaN(parsed) ? undefined : parsed,
              },
              true,
            );
          }}
          placeholder="e.g. 20"
        />
      </Field>
    </>
  );
}
