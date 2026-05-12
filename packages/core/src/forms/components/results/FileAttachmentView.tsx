'use client';

import { useState } from 'react';
import { Download, ExternalLink, FileText, Image as ImageIcon, Music, Paperclip, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '../../../ui/button';
import { coerceFileAttachment, formatBytes, mimeKind, type MediaKind } from '../../lib/file-attachment';

interface FileAttachmentViewProps {
  /** Either the rich `FileAttachmentValue` object or a legacy URL string. */
  value: unknown;
}

const KIND_ICON: Record<MediaKind, LucideIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  pdf: FileText,
  text: FileText,
  other: Paperclip,
};

/**
 * Rich attachment viewer. Shows filename + size + MIME, an inline preview
 * appropriate to the file kind (image / video / audio / pdf / text-snippet),
 * and explicit Open + Download actions. Handles legacy URL-string values
 * by synthesizing a minimal record.
 */
export function FileAttachmentView({ value }: FileAttachmentViewProps) {
  const attachment = coerceFileAttachment(value);
  if (!attachment) return null;

  const kind = mimeKind(attachment);
  const Icon = KIND_ICON[kind];
  // Walrus aggregator URLs are content-addressed and don't carry the
  // original filename. We append it via the `?filename=` query so most
  // browsers honor it in the Download dialog. Walrus ignores unknown
  // query params; aggregator still returns the blob.
  const downloadUrl = appendFilenameParam(attachment.url, attachment.name);

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-muted/30 flex items-center gap-2 rounded-md border px-3 py-2">
        <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col">
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm font-medium underline-offset-2 hover:underline"
            title={attachment.name}
          >
            {attachment.name}
          </a>
          <span className="text-muted-foreground text-[11px]">
            {attachment.size > 0 && <>{formatBytes(attachment.size)} · </>}
            {attachment.type || `kind: ${kind}`}
          </span>
        </div>
        <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
          <a href={attachment.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-3 w-3" />
            Open
          </a>
        </Button>
        <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
          <a href={downloadUrl} download={attachment.name}>
            <Download className="mr-1 h-3 w-3" />
            Download
          </a>
        </Button>
      </div>

      <Preview attachment={attachment} kind={kind} />
    </div>
  );
}

function Preview({
  attachment,
  kind,
}: {
  attachment: ReturnType<typeof coerceFileAttachment> & object;
  kind: MediaKind;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  if (kind === 'image') {
    return (
      <img
        src={attachment.url}
        alt={attachment.name}
        className="max-h-72 max-w-full rounded-md border object-contain"
        onError={() => setFailed(true)}
      />
    );
  }
  if (kind === 'video') {
    // No <track> available — submitter-uploaded arbitrary videos have no
    // captions file. The download link above remains the a11y fallback.
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={attachment.url}
        controls
        preload="metadata"
        className="max-h-72 max-w-full rounded-md border bg-black"
        onError={() => setFailed(true)}
      >
        Your browser cannot preview this attachment.
      </video>
    );
  }
  if (kind === 'audio') {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <audio
        src={attachment.url}
        controls
        preload="metadata"
        className="w-full"
        onError={() => setFailed(true)}
      />
    );
  }
  if (kind === 'pdf') {
    return (
      <iframe
        src={attachment.url}
        title={attachment.name}
        className="h-96 w-full rounded-md border"
      />
    );
  }
  // text / other: no inline preview — Open/Download links above suffice.
  return null;
}

function appendFilenameParam(url: string, name: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('filename', name);
    return u.toString();
  } catch {
    return url;
  }
}
