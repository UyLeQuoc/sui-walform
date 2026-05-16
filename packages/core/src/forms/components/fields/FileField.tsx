'use client';

import { useRef } from 'react';
import { Paperclip, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { Button } from '../../../ui/button';
import { coerceFileAttachment, formatBytes } from '../../lib/file-attachment';
import { PreviewField } from '../preview/PreviewField';
import type { FormField } from '../../../types';

interface FileFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

/** Hard cap to keep a single Walrus blob within sane testnet bounds. */
const MAX_FILE_BYTES = 100 * 1024 * 1024;

/**
 * File picker that *defers* the Walrus upload until form submit. The picked
 * `File` is stored directly in the RHF value; the global submit flow detects
 * it, uploads it to Walrus alongside the encrypted body, and rewrites the
 * value with a serializable attachment object before broadcasting.
 *
 * The submit flow renders a `<TxSteps>` indicator so the respondent sees the
 * upload progress without needing a per-field button.
 *
 * Values handled here:
 *  - `File` — pending upload (just picked)
 *  - `FileAttachmentValue` — already uploaded (legacy state or post-submit)
 *  - URL string — legacy pre-rich-attachment value
 */
export function FileField({ field, control }: FileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => {
        const valueAsFile =
          typeof File !== 'undefined' && rhf.value instanceof File ? (rhf.value as File) : null;
        // For non-File values, coerce into the rich-attachment shape (or null).
        const attachment = valueAsFile ? null : coerceFileAttachment(rhf.value);

        const handlePick = () => inputRef.current?.click();

        const handleSelect = (file: File) => {
          if (file.size > MAX_FILE_BYTES) {
            toast.error(`File too large — max ${formatMiB(MAX_FILE_BYTES)} MiB.`);
            return;
          }
          rhf.onChange(file);
        };

        const handleClear = () => {
          rhf.onChange('');
          if (inputRef.current) inputRef.current.value = '';
        };

        return (
          <PreviewField field={field} error={fieldState.error?.message} htmlFor={field.id}>
            <input
              ref={inputRef}
              id={field.id}
              type="file"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSelect(file);
              }}
              onBlur={rhf.onBlur}
            />

            {attachment ? (
              // Already-uploaded attachment (resumed draft, or rendered after
              // a successful submit). Show the Walrus details + Remove.
              <FilePill
                name={attachment.name}
                meta={`${attachment.size > 0 ? `${formatBytes(attachment.size)} · ` : ''}${attachment.type || 'unknown type'} · on Walrus`}
                href={attachment.url}
                onRemove={handleClear}
              />
            ) : valueAsFile ? (
              // Pending file — auto-uploads on submit. No per-field button.
              <FilePill
                name={valueAsFile.name}
                meta={`${formatBytes(valueAsFile.size)}${valueAsFile.type ? ` · ${valueAsFile.type}` : ''} · will upload to Walrus on submit`}
                onRemove={handleClear}
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handlePick}
                className="w-full justify-start"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {field.placeholder ?? `Choose any file (max ${formatMiB(MAX_FILE_BYTES)} MiB)`}
              </Button>
            )}
          </PreviewField>
        );
      }}
    />
  );
}

function FilePill({
  name,
  meta,
  href,
  onRemove,
}: {
  name: string;
  meta: string;
  href?: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <Paperclip className="text-muted-foreground h-4 w-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate underline-offset-2 hover:underline"
            title={name}
          >
            {name}
          </a>
        ) : (
          <span className="truncate font-medium" title={name}>
            {name}
          </span>
        )}
        <span className="text-muted-foreground text-[11px]">{meta}</span>
      </div>
      <Button type="button" variant="ghost" onClick={onRemove} aria-label="Remove file">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function formatMiB(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}
