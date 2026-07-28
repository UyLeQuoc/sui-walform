'use client';

import { Field, FieldDescription, FieldLabel } from '../../../../ui/field';
import { Input } from '../../../../ui/input';
import { Switch } from '../../../../ui/switch';
import { DEFAULT_MAX_FILE_MB, formatFileSizeCap } from '../../../lib/file-attachment';
import { useFormBuilderStore } from '../../../store/form-builder-store';
import type { FormField } from '../../../../types';

interface FileSettingsProps {
  field: FormField;
}

/**
 * Settings for the `file` field — a per-form upload size cap. `maxFileMb`
 * follows the codebase's `0 = unlimited` convention: `0` means no limit,
 * `undefined` falls back to the default cap, a positive value caps at that
 * many MB. Enforced client-side (in `FileField` + the submit-time Zod
 * schema) — file bytes go to Walrus, so the contract can't verify size.
 */
export function FileSettings({ field }: FileSettingsProps) {
  const updateField = useFormBuilderStore((s) => s.updateField);
  const updateFieldDeferred = useFormBuilderStore((s) => s.updateFieldDeferred);

  const maxFileMb = field.validation?.maxFileMb;
  const unlimited = maxFileMb === 0;

  const setMaxFileMb = (value: number | undefined, deferred = false) => {
    const next = { ...(field.validation ?? {}), maxFileMb: value };
    (deferred ? updateFieldDeferred : updateField)(field.id, { validation: next });
  };

  return (
    <>
      <Field orientation="horizontal">
        <FieldLabel htmlFor="file-unlimited">No size limit</FieldLabel>
        <Switch
          id="file-unlimited"
          checked={unlimited}
          onCheckedChange={(checked) => setMaxFileMb(checked ? 0 : undefined)}
        />
      </Field>

      {!unlimited && (
        <Field>
          <FieldLabel htmlFor="file-max-mb">Max file size (MB)</FieldLabel>
          <FieldDescription>
            Leave empty for the default {formatFileSizeCap(DEFAULT_MAX_FILE_MB * 1024 * 1024)}.
          </FieldDescription>
          <Input
            id="file-max-mb"
            type="number"
            min={1}
            value={maxFileMb ?? ''}
            placeholder={String(DEFAULT_MAX_FILE_MB)}
            onChange={(e) => {
              const raw = e.target.value;
              const parsed = raw === '' ? undefined : Number(raw);
              setMaxFileMb(
                parsed === undefined || Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed,
                true,
              );
            }}
          />
        </Field>
      )}
    </>
  );
}
