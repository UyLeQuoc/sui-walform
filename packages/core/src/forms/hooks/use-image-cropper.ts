'use client';

import { useCallback, useState } from 'react';
import type { Area } from 'react-easy-crop';
import { toast } from 'sonner';
import { cropImageToDataUrl } from '../lib/crop-image';

interface UseImageCropperParams {
  /** Source image data URL (null when the dialog is closed). */
  source: string | null;
  /** Receives the cropped data URL once the user confirms. */
  onCropped: (dataUrl: string) => void;
  /** Closes the parent dialog after a successful crop. */
  onClose: () => void;
}

export interface UseImageCropperResult {
  crop: { x: number; y: number };
  setCrop: (crop: { x: number; y: number }) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  isApplying: boolean;
  /** Whether the Apply button should be enabled. */
  canApply: boolean;
  handleCropComplete: (area: Area, areaPixels: Area) => void;
  handleApply: () => Promise<void>;
}

/**
 * State + handlers for the cover-image cropper. Resets crop / zoom
 * during render whenever the source image changes (per the React docs'
 * recommendation for prop-driven resets — beats an effect that always
 * runs one frame late).
 */
export function useImageCropper({
  source,
  onCropped,
  onClose,
}: UseImageCropperParams): UseImageCropperResult {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [trackedSource, setTrackedSource] = useState(source);

  if (source !== trackedSource) {
    setTrackedSource(source);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleApply = async () => {
    if (!source || !croppedAreaPixels) return;
    setIsApplying(true);
    try {
      const cropped = await cropImageToDataUrl(source, croppedAreaPixels);
      onCropped(cropped);
      onClose();
    } catch (err) {
      console.error('[useImageCropper] crop failed:', err);
      // The size-cap path throws a descriptive Error; show it so the
      // user knows to crop tighter rather than retrying blindly.
      const message =
        err instanceof Error && err.message.startsWith('Cover image is too large')
          ? err.message
          : 'Could not crop the image. Please try another file.';
      toast.error(message);
    } finally {
      setIsApplying(false);
    }
  };

  return {
    crop,
    setCrop,
    zoom,
    setZoom,
    isApplying,
    canApply: croppedAreaPixels !== null && source !== null,
    handleCropComplete,
    handleApply,
  };
}
