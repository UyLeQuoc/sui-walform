'use client';

import Cropper from 'react-easy-crop';
import { Button } from '../../../ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Slider } from '../../../ui/slider';
import { useImageCropper } from '../../hooks/use-image-cropper';

export const COVER_ASPECT_RATIO = 3 / 1;

interface CoverImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Data URL of the source image, rendered inside the cropper. */
  source: string | null;
  /** Receives the cropped data URL. Only this value is persisted. */
  onCropped: (dataUrl: string) => void;
}

/**
 * Modal crop step that enforces the 3:1 banner aspect before a cover image
 * reaches the store. The source data URL lives only in the parent's React
 * state while this dialog is open — IndexedDB never sees the original.
 */
export function CoverImageCropDialog({
  open,
  onOpenChange,
  source,
  onCropped,
}: CoverImageCropDialogProps) {
  const cropper = useImageCropper({
    source,
    onCropped,
    onClose: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Crop cover image</DialogTitle>
          <DialogDescription>
            Drag to reposition and use the slider to zoom. The crop is locked to the 3:1 banner
            ratio.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted relative h-[320px] w-full overflow-hidden rounded-md">
          {source ? (
            <Cropper
              image={source}
              crop={cropper.crop}
              zoom={cropper.zoom}
              aspect={COVER_ASPECT_RATIO}
              onCropChange={cropper.setCrop}
              onZoomChange={cropper.setZoom}
              onCropComplete={cropper.handleCropComplete}
              zoomWithScroll
              showGrid
            />
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-muted-foreground shrink-0 text-xs">Zoom</span>
          <Slider
            value={[cropper.zoom]}
            onValueChange={(v) => cropper.setZoom(v[0] ?? 1)}
            min={1}
            max={3}
            step={0.01}
            aria-label="Zoom"
            className="bg-muted-foreground h-1 flex-1 rounded"
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={cropper.isApplying}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={cropper.handleApply} disabled={cropper.isApplying || !cropper.canApply}>
            {cropper.isApplying ? 'Applying…' : 'Apply crop'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
