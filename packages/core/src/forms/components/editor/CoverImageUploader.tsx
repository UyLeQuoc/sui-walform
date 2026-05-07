'use client';

import { type ReactNode } from 'react';
import { useCoverImageUpload } from '../../hooks/use-cover-image-upload';
import { CoverImageCropDialog } from './CoverImageCropDialog';

interface CoverImageUploaderProps {
  /** Render prop: receives the trigger fn to wire onto your own button/control. */
  children: (trigger: () => void) => ReactNode;
}

/**
 * Encapsulates the full cover-image upload flow: hidden file input, size /
 * type validation, crop dialog, and the single store write.
 *
 * **Drafts hold the data URL** (base64) — kept local + IDB-persisted so
 * authoring is fast and offline. Walrus upload happens once at publish time,
 * inside `runPublish`, before the create-form tx is built. This keeps the
 * on-chain schema bytes small (the contract caps schema at 100 KB; a base64
 * cover image alone could blow that cap).
 */
export function CoverImageUploader({ children }: CoverImageUploaderProps) {
  const { inputRef, trigger, handleInputChange, cropSource, setCropDialogOpen, handleCropped } =
    useCoverImageUpload();

  return (
    <>
      {children(trigger)}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleInputChange}
      />
      <CoverImageCropDialog
        open={cropSource !== null}
        onOpenChange={setCropDialogOpen}
        source={cropSource}
        onCropped={handleCropped}
      />
    </>
  );
}
