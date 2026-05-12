import type { FileAttachmentValue } from '../../types';

/**
 * Type-narrowing helper. New FileField submissions store a rich object;
 * legacy ones stored just the aggregator URL string. Use this anywhere a
 * file value is consumed so both shapes render correctly.
 */
export function isFileAttachmentValue(v: unknown): v is FileAttachmentValue {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { url?: unknown }).url === 'string' &&
    typeof (v as { name?: unknown }).name === 'string'
  );
}

/**
 * Coerce a raw value (string URL or rich object) into a renderable
 * attachment. Legacy strings get synthesized name / unknown type / size 0.
 */
export function coerceFileAttachment(v: unknown): FileAttachmentValue | null {
  if (isFileAttachmentValue(v)) return v;
  if (typeof v === 'string' && v.length > 0) {
    return {
      url: v,
      name: deriveLegacyName(v),
      size: 0,
      type: '',
    };
  }
  return null;
}

function deriveLegacyName(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last && last.length > 0 ? last : 'attachment';
  } catch {
    return 'attachment';
  }
}

/** Human-friendly byte sizing (1.2 KiB, 28.4 MiB). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

export type MediaKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'other';

/**
 * Map a MIME type (or filename fallback) to a coarse kind so the viewer
 * picks the right inline element. Empty MIME falls back to a filename
 * extension probe — Walrus aggregator URLs never carry one, but the stored
 * filename usually does.
 */
export function mimeKind(att: FileAttachmentValue): MediaKind {
  const lower = att.type.toLowerCase();
  if (lower.startsWith('image/')) return 'image';
  if (lower.startsWith('video/')) return 'video';
  if (lower.startsWith('audio/')) return 'audio';
  if (lower === 'application/pdf') return 'pdf';
  if (lower.startsWith('text/')) return 'text';

  const ext = att.name.toLowerCase().split('.').pop() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (['txt', 'md', 'csv', 'json', 'log'].includes(ext)) return 'text';
  return 'other';
}
