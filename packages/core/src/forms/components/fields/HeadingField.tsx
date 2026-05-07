'use client';

import { cn } from '../../../lib/utils';
import type { FormField } from '../../../types';

interface HeadingFieldProps {
  field: FormField;
}

const HEADING_CLASSES = {
  h1: 'text-3xl font-bold',
  h2: 'text-xl font-semibold',
  h3: 'text-lg font-medium',
} as const;

const TEXT_ALIGN_CLASSES = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

function buildTextDecoration(field: FormField): string | undefined {
  const parts: string[] = [];
  if (field.fontUnderline) parts.push('underline');
  if (field.fontStrikethrough) parts.push('line-through');
  return parts.length > 0 ? parts.join(' ') : undefined;
}

export function HeadingField({ field }: HeadingFieldProps) {
  const level = field.headingLevel ?? 'h2';
  const align = field.textAlign ?? 'left';
  const Tag = level;

  return (
    <div className="px-3 py-2">
      <Tag
        className={cn('leading-tight', HEADING_CLASSES[level], TEXT_ALIGN_CLASSES[align])}
        style={{
          fontWeight: field.fontBold ? 'bold' : undefined,
          fontStyle: field.fontItalic ? 'italic' : undefined,
          textDecoration: buildTextDecoration(field),
        }}
      >
        {field.label || 'Heading'}
      </Tag>
    </div>
  );
}
