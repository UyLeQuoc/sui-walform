'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { readFileAsDataUrl } from '../lib/read-file-data-url';
import { useFormBuilderStore } from '../store/form-builder-store';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export interface UseCoverImageUploadResult {
  /** Hidden `<input type="file">` ref the consumer renders into the DOM. */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Imperative trigger for the consumer's button onClick. */
  trigger: () => void;
  /** onChange handler for the hidden file input. */
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Source image data URL while the cropper dialog is open. */
  cropSource: string | null;
  /** Open-state setter for the cropper dialog. */
  setCropDialogOpen: (open: boolean) => void;
  /** Receives the cropped data URL from the dialog and persists it. */
  handleCropped: (dataUrl: string) => void;
}

/**
 * Full cover-image upload flow: file-input ref, type/size validation,
 * FileReader → data URL conversion, cropper-dialog state, and the store
 * write.
 *
 * Drafts always hold the data URL — Walrus upload happens at publish time so
 * we don't race optimistic uploads against the user's Publish click.
 */
export function useCoverImageUpload(): UseCoverImageUploadResult {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const updateCoverImage = useFormBuilderStore((s) => s.updateCoverImage);
  const setIsCoverSelected = useFormBuilderStore((s) => s.setIsCoverSelected);

  const trigger = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image is too large. Max 4MB.');
      return;
    }
    try {
      setCropSource(await readFileAsDataUrl(file));
    } catch (err) {
      console.error('[useCoverImageUpload] failed to read file:', err);
      toast.error('Could not read image file.');
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = '';
  };

  const setCropDialogOpen = (open: boolean) => {
    if (!open) setCropSource(null);
  };

  const handleCropped = (dataUrl: string) => {
    updateCoverImage(dataUrl);
    // Drop the cover-selection so the right sidebar doesn't stay pinned
    // to the properties panel after the user finishes cropping.
    setIsCoverSelected(false);
  };

  return {
    inputRef,
    trigger,
    handleInputChange,
    cropSource,
    setCropDialogOpen,
    handleCropped,
  };
}
