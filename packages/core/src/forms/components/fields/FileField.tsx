'use client';

import { useRef, useState } from 'react';
import { Paperclip, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { Button } from '../../../ui/button';
import { Spinner } from '../../../ui/spinner';
import { useWalrusWalletUpload } from '../../../walrus';
import { PreviewField } from '../preview/PreviewField';
import type { FormField } from '../../../types';

interface FileFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

const MAX_FILE_BYTES = 4 * 1024 * 1024;

/**
 * File upload that goes straight to Walrus on selection. The form value is
 * the aggregator URL — small, JSON-serializable, decodes cleanly into the
 * encrypted submission body. The filename is shown locally during the session
 * but isn't persisted (results display the URL itself).
 */
export function FileField({ field, control }: FileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const { uploadBlob, isReady } = useWalrusWalletUpload();

  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => {
        const value = typeof rhf.value === 'string' ? rhf.value : '';
        const handlePick = () => inputRef.current?.click();
        const handleClear = () => {
          rhf.onChange('');
          setFilename('');
          if (inputRef.current) inputRef.current.value = '';
        };
        const handleFile = async (file: File) => {
          if (file.size > MAX_FILE_BYTES) {
            toast.error(`File too large — max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MiB.`);
            return;
          }
          if (!isReady) {
            toast.error('Connect a wallet on testnet/mainnet to upload files to Walrus.');
            return;
          }
          setFilename(file.name);
          setIsUploading(true);
          try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const { url } = await uploadBlob(bytes, { epochs: 5 });
            rhf.onChange(url);
            toast.success(`Uploaded ${file.name} to Walrus`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(`Upload failed: ${msg}`);
            console.error('[FileField] upload failed:', err);
            // Leave the form value empty on failure so validation re-fires.
            rhf.onChange('');
          } finally {
            setIsUploading(false);
          }
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
                if (file) void handleFile(file);
              }}
              onBlur={rhf.onBlur}
            />
            {value ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Paperclip className="text-muted-foreground h-4 w-4 shrink-0" />
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate underline-offset-2 hover:underline"
                  title={filename || value}
                >
                  {filename || 'Attached file'}
                </a>
                <span className="text-muted-foreground ml-auto text-xs">on Walrus</span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClear}
                  disabled={isUploading}
                  aria-label="Remove file"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handlePick}
                disabled={isUploading}
                className="w-full justify-start"
              >
                {isUploading ? (
                  <Spinner className="mr-1.5 size-3.5" />
                ) : (
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                )}
                {isUploading
                  ? `Uploading ${filename}…`
                  : (field.placeholder ?? 'Choose a file (max 4 MiB)')}
              </Button>
            )}
          </PreviewField>
        );
      }}
    />
  );
}
