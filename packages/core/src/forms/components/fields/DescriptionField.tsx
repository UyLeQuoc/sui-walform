'use client';

import { cn } from '../../../lib/utils';
import type { FormField } from '../../../types';

interface DescriptionFieldProps {
  field: FormField;
}

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

export function DescriptionField({ field }: DescriptionFieldProps) {
  const align = field.textAlign ?? 'left';

  if (!field.label) return null;

  return (
    <div className="px-3 py-2">
      <p
        className={cn('text-muted-foreground text-sm leading-relaxed', TEXT_ALIGN_CLASSES[align])}
        style={{
          fontWeight: field.fontBold ? 'bold' : undefined,
          fontStyle: field.fontItalic ? 'italic' : undefined,
          textDecoration: buildTextDecoration(field),
        }}
      >
        {field.label}
      </p>
    </div>
  );
}
