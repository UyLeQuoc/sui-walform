'use client';

import { useState } from 'react';
import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { CodeEditor } from '../CodeEditor';
import { PreviewField } from '../preview/PreviewField';
import { AUTO_DETECT_KEY, getCodeLanguage } from '../../lib/code-languages';
import type { FormField } from '../../../types';

interface CodeFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

export function CodeField({ field, control }: CodeFieldProps) {
  const isAuto = field.codeLanguage === AUTO_DETECT_KEY;
  const [detectedKey, setDetectedKey] = useState<string | null>(null);

  // When auto-detect is on, the editor reports the current best match. Use
  // that for the badge; otherwise display the explicit language label.
  const badgeLabel = isAuto
    ? `Auto · ${getCodeLanguage(detectedKey ?? 'plaintext').label}`
    : getCodeLanguage(field.codeLanguage).label;

  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => (
        <PreviewField field={field} error={fieldState.error?.message} htmlFor={field.id}>
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span className="bg-muted inline-flex items-center rounded px-1.5 py-0.5 font-mono">
                {badgeLabel}
              </span>
              <CodeFieldCounter
                value={rhf.value ?? ''}
                maxLength={field.validation?.maxLength}
                maxLines={field.validation?.maxLines}
              />
            </div>
            <CodeEditor
              id={field.id}
              value={rhf.value ?? ''}
              onChange={rhf.onChange}
              onBlur={rhf.onBlur}
              language={field.codeLanguage}
              onDetectLanguage={isAuto ? setDetectedKey : undefined}
              placeholder={field.placeholder ?? 'Write your code…'}
              ariaInvalid={!!fieldState.error}
            />
          </div>
        </PreviewField>
      )}
    />
  );
}

function CodeFieldCounter({
  value,
  maxLength,
  maxLines,
}: {
  value: string;
  maxLength?: number;
  maxLines?: number;
}) {
  if (!maxLength && !maxLines) return null;
  const chars = value.length;
  const lines = value.length === 0 ? 0 : value.split(/\r\n|\r|\n/).length;
  return (
    <span className="flex gap-3 tabular-nums">
      {maxLength ? (
        <span className={chars > maxLength ? 'text-destructive' : undefined}>
          {chars} / {maxLength} chars
        </span>
      ) : null}
      {maxLines ? (
        <span className={lines > maxLines ? 'text-destructive' : undefined}>
          {lines} / {maxLines} lines
        </span>
      ) : null}
    </span>
  );
}
