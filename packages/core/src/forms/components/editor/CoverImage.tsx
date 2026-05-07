/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
'use client';

import { ImageIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button } from '../../../ui/button';
import { useFormBuilderStore } from '../../store/form-builder-store';
import { CoverImageUploader } from './CoverImageUploader';

/**
 * Read-only cover image view. Used by `FormPreview` which receives the schema
 * as a prop instead of reading from the store.
 */
export function CoverImageView({ src, className }: { src?: string; className?: string }) {
  if (!src) return null;
  return (
    <div className={cn('w-full', className)}>
      <div className="bg-muted aspect-cover w-full overflow-hidden rounded-xl">
        <img
          src={src}
          alt="Form cover"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="pointer-events-none h-full w-full object-cover select-none"
        />
      </div>
    </div>
  );
}

interface CoverImageEditorProps {
  className?: string;
}

/**
 * Editable cover image placed above the form title in the builder. Clicking
 * it selects the cover block — mutually exclusive with field/submit selection
 * — and the right sidebar swaps in `CoverImageSettingsPanel` with upload,
 * replace, and remove controls. The image itself has no hover chrome: all
 * actions live in the sidebar.
 */
export function CoverImageEditor({ className }: CoverImageEditorProps) {
  const coverImage = useFormBuilderStore((s) => s.schema.coverImage);
  const isCoverSelected = useFormBuilderStore((s) => s.isCoverSelected);
  const setIsCoverSelected = useFormBuilderStore((s) => s.setIsCoverSelected);

  if (!coverImage) {
    return (
      <div className={cn('flex w-full justify-center', className)}>
        <CoverImageUploader>
          {(trigger) => (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={trigger}
            >
              <ImageIcon data-icon="inline-start" />
              Add cover image
            </Button>
          )}
        </CoverImageUploader>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsCoverSelected(true)}
      className={cn(
        'group relative w-full cursor-pointer rounded-xl transition-[box-shadow,outline] duration-150',
        isCoverSelected && 'ring-primary/50 ring-offset-background ring-[3px] ring-offset-2',
        className,
      )}
    >
      <div className="bg-muted aspect-cover w-full overflow-hidden rounded-xl">
        <img
          src={coverImage}
          alt="Form cover"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="pointer-events-none h-full w-full object-cover select-none"
        />
      </div>
    </div>
  );
}
