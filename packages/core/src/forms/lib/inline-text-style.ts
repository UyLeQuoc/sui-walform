import type { CSSProperties } from 'react';
import type { FormField } from '../../types';

export const HEADING_CLASSES = {
  h1: 'text-3xl font-bold',
  h2: 'text-2xl font-semibold',
  h3: 'text-xl font-medium',
} as const;

export const TEXT_ALIGN_CLASSES = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

/**
 * Builds the inline-style object for a heading / description block from
 * its bold / italic / underline / strikethrough toggles.
 */
export function buildInlineTextStyle(field: FormField): CSSProperties {
  const decorations: string[] = [];
  if (field.fontUnderline) decorations.push('underline');
  if (field.fontStrikethrough) decorations.push('line-through');
  return {
    fontWeight: field.fontBold ? 'bold' : undefined,
    fontStyle: field.fontItalic ? 'italic' : undefined,
    textDecoration: decorations.length > 0 ? decorations.join(' ') : undefined,
  };
}
