'use client';

import { ImageIcon, Trash2, UploadCloud, X } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Field, FieldGroup, FieldLabel } from '../../../ui/field';
import { cn } from '../../../lib/utils';
import { useFormBuilderStore } from '../../store/form-builder-store';
import { CoverImageUploader } from './CoverImageUploader';

interface CoverImageSettingsPanelProps {
  className?: string;
}

/**
 * Right-sidebar properties panel for the form's cover image. Mirrors the
 * submit/field settings panels so the sidebar switch feels seamless. All
 * upload / replace / remove actions live here so the canvas image itself
 * stays free of hover chrome.
 */
export function CoverImageSettingsPanel({ className }: CoverImageSettingsPanelProps) {
  const coverImage = useFormBuilderStore((s) => s.schema.coverImage);
  const updateCoverImage = useFormBuilderStore((s) => s.updateCoverImage);
  const setIsCoverSelected = useFormBuilderStore((s) => s.setIsCoverSelected);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="bg-muted/60 flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
          <ImageIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Cover image</p>
          <p className="text-muted-foreground truncate text-xs">Properties</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Deselect cover image"
          onClick={() => setIsCoverSelected(false)}
          className="h-7 w-7"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <FieldGroup>
          <Field>
            <FieldLabel>Preview</FieldLabel>
            <div className="bg-muted aspect-cover w-full overflow-hidden rounded-md border">
              {coverImage ? (
                <img
                  src={coverImage}
                  alt="Form cover preview"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  className="pointer-events-none h-full w-full object-cover select-none"
                />
              ) : (
                <div className="text-muted-foreground/70 flex h-full w-full items-center justify-center text-xs">
                  No image
                </div>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Banner aspect ratio (3:1). PNG or JPG, up to 4MB.
            </p>
          </Field>

          <Field>
            <FieldLabel>{coverImage ? 'Replace image' : 'Upload image'}</FieldLabel>
            <CoverImageUploader>
              {(trigger) => (
                <Button type="button" variant="outline" className="w-full" onClick={trigger}>
                  <UploadCloud data-icon="inline-start" />
                  {coverImage ? 'Choose new image' : 'Upload from device'}
                </Button>
              )}
            </CoverImageUploader>
          </Field>

          {coverImage && (
            <Field>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => updateCoverImage(null)}
              >
                <Trash2 data-icon="inline-start" />
                Remove cover image
              </Button>
            </Field>
          )}
        </FieldGroup>
      </div>
    </div>
  );
}
