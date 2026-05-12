'use client';

import { useRef, useState } from 'react';
import { Copy, Download, ImageDown, Link2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Input } from '../../../ui/input';
import { buildFormShareLink, copyFormShareLink } from '../../lib/share-link';

interface ShareFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  formTitle: string;
}

/**
 * Modal exposing the public submit URL with copy + QR. The QR renders into a
 * canvas via `qrcode.react`, which lets us pull a PNG data URL for download
 * and a Blob for clipboard image writes — both behaviors mirror what
 * Google Forms / Tally surface in their share dialogs.
 */
export function ShareFormDialog({ open, onOpenChange, formId, formTitle }: ShareFormDialogProps) {
  const url = buildFormShareLink(formId);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [isCopyingImage, setIsCopyingImage] = useState(false);

  const getCanvas = (): HTMLCanvasElement | null =>
    canvasWrapperRef.current?.querySelector('canvas') ?? null;

  const handleCopyLink = async () => {
    if (await copyFormShareLink(formId)) {
      toast.success('Share link copied');
    } else {
      toast.error('Clipboard unavailable');
    }
  };

  const handleDownloadQr = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = data;
    a.download = `${slugify(formTitle) || 'form'}-qr.png`;
    a.click();
  };

  const handleCopyQr = async () => {
    const canvas = getCanvas();
    if (!canvas) return;
    setIsCopyingImage(true);
    try {
      // ClipboardItem requires a Blob; toBlob is async.
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error('Canvas conversion failed'));
            return;
          }
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            resolve();
          } catch (err) {
            reject(err);
          }
        }, 'image/png');
      });
      toast.success('QR copied to clipboard');
    } catch {
      // Safari and some embedded browsers refuse ClipboardItem — fall back to
      // download so the user can still grab the image.
      toast.error('Clipboard image not supported — try Download instead');
    } finally {
      setIsCopyingImage(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this form</DialogTitle>
          <DialogDescription>
            Anyone with the link can open the public submit page. Submissions are encrypted
            client-side before they hit chain.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
            <Link2 className="h-3.5 w-3.5" />
            Public link
          </span>
          <div className="flex items-center gap-2">
            <Input
              value={url}
              readOnly
              aria-label="Public form URL"
              className="font-mono text-xs"
            />
            <Button size="sm" variant="outline" onClick={() => void handleCopyLink()}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 pt-2">
          <div
            ref={canvasWrapperRef}
            className="rounded-xl border bg-white p-3"
            aria-label="QR code for share link"
          >
            <QRCodeCanvas
              value={url}
              size={224}
              level="M"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDownloadQr}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download PNG
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleCopyQr()}
              disabled={isCopyingImage}
            >
              <ImageDown className="mr-1.5 h-3.5 w-3.5" />
              {isCopyingImage ? 'Copying…' : 'Copy image'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
