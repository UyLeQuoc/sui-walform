import { isFileAttachmentValue } from './file-attachment';

/**
 * Stringify a decoded-submission value for CSV cells. Arrays join with `,`,
 * file attachments render as "name (url)" so a spreadsheet stays clickable,
 * other objects JSON-stringify, primitives coerce to string. nulls/undefined → ''.
 */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (isFileAttachmentValue(value)) {
    return value.name ? `${value.name} (${value.url})` : value.url;
  }
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
