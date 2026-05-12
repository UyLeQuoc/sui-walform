'use client';

import { useRef, useState } from 'react';
import { Paperclip, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { Button } from '../../../ui/button';
import { Spinner } from '../../../ui/spinner';
import { formatWal, useStorageCost, useWalrusWalletUpload } from '../../../walrus';
import { coerceFileAttachment, formatBytes } from '../../lib/file-attachment';
import { PreviewField } from '../preview/PreviewField';
import type { FileAttachmentValue, FormField } from '../../../types';

interface FileFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

/** Hard cap to keep a single Walrus blob within sane testnet bounds. */
const MAX_FILE_BYTES = 100 * 1024 * 1024;
/** Walrus epoch count for attachments — matches submission body retention (~1 year on testnet). */
const ATTACHMENT_EPOCHS = 53;

/**
 * Two-step upload-to-Walrus flow. The user picks any file (≤100 MiB), sees
 * its size + storage cost estimate, and only commits the upload by clicking
 * Upload — so big-file surprises are caught before WAL is spent.
 *
 * Form value persists as the aggregator URL (small, JSON-serializable, fits
 * cleanly inside the encrypted submission body). Anyone who can decrypt the
 * submission (creator + reviewers + submitter) gets the URL and can fetch
 * the file from Walrus directly.
 */
export function FileField({ field, control }: FileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { uploadBlob, isReady } = useWalrusWalletUpload();
  const cost = useStorageCost(pendingFile?.size ?? 0, ATTACHMENT_EPOCHS);

  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => {
        // rhf.value may be the new rich object OR a legacy URL string; coerce
        // to a single shape for display, store new rich object on upload.
        const attachment = coerceFileAttachment(rhf.value);

        const handlePick = () => inputRef.current?.click();

        const handleSelect = (file: File) => {
          if (file.size > MAX_FILE_BYTES) {
            toast.error(`File too large — max ${formatMiB(MAX_FILE_BYTES)} MiB.`);
            return;
          }
          if (!isReady) {
            toast.error('Connect a wallet on testnet/mainnet to upload to Walrus.');
            return;
          }
          setPendingFile(file);
        };

        const handleCancel = () => {
          setPendingFile(null);
          if (inputRef.current) inputRef.current.value = '';
        };

        const handleUpload = async () => {
          if (!pendingFile || !isReady) return;
          setIsUploading(true);
          try {
            const bytes = new Uint8Array(await pendingFile.arrayBuffer());
            const { url } = await uploadBlob(bytes, { epochs: ATTACHMENT_EPOCHS });
            const next: FileAttachmentValue = {
              url,
              name: pendingFile.name,
              size: pendingFile.size,
              type: pendingFile.type || '',
            };
            rhf.onChange(next);
            setPendingFile(null);
            toast.success(`Uploaded ${pendingFile.name} to Walrus`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(`Upload failed: ${msg}`);
            console.error('[FileField] upload failed:', err);
          } finally {
            setIsUploading(false);
          }
        };

        const handleClear = () => {
          rhf.onChange('');
          setPendingFile(null);
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
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Paperclip className="text-muted-foreground h-4 w-4 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate underline-offset-2 hover:underline"
                    title={attachment.name}
                  >
                    {attachment.name}
                  </a>
                  <span className="text-muted-foreground text-[11px]">
                    {attachment.size > 0 && <>{formatBytes(attachment.size)} · </>}
                    {attachment.type || 'unknown type'} · on Walrus
                  </span>
                </div>
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
            ) : pendingFile ? (
              <div className="flex flex-col gap-3 rounded-md border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Paperclip className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="truncate font-medium" title={pendingFile.name}>
                    {pendingFile.name}
                  </span>
                  <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                    {formatBytes(pendingFile.size)}
                  </span>
                </div>

                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border-dashed bg-muted/30 px-3 py-2 text-xs">
                  <span className="font-medium">Walrus storage cost</span>
                  {cost.isLoading && <Spinner className="size-3" />}
                  {cost.cost && (
                    <>
                      <span className="tabular-nums">
                        {formatWal(cost.cost.totalCost)} WAL
                      </span>
                      <span className="text-muted-foreground/70">
                        ({ATTACHMENT_EPOCHS} epochs · ~1 year)
                      </span>
                    </>
                  )}
                  {!cost.isLoading && !cost.cost && cost.error && (
                    <span className="text-destructive">
                      Cost unavailable — upload anyway?
                    </span>
                  )}
                  {!cost.isLoading && !cost.cost && !cost.error && (
                    <span className="text-muted-foreground/70">— estimating —</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleUpload()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Spinner className="mr-1.5 size-3.5" />
                    ) : (
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {isUploading ? 'Uploading…' : 'Upload to Walrus'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handlePick}
                disabled={isUploading}
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

function formatMiB(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}
