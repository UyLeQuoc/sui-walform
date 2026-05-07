'use client';

import { cn } from '../../../lib/utils';
import type { FormField } from '../../../types';
import { FieldTypeIcon } from '../FieldTypeIcon';
import { FieldEditPreview } from './FieldEditPreview';

interface FieldBlockGhostProps {
  field: FormField;
}

const HEADING_CLASSES = {
  h1: 'text-3xl font-bold',
  h2: 'text-2xl font-semibold',
  h3: 'text-xl font-medium',
} as const;

const TEXT_ALIGN_CLASSES = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

export function FieldBlockGhost({ field }: FieldBlockGhostProps) {
  // Divider + space — no label row, just the preview block.
  if (field.type === 'divider' || field.type === 'space') {
    return (
      <div className="bg-background rounded-md px-3 py-2 opacity-50">
        <FieldEditPreview field={field} />
      </div>
    );
  }

  // Heading & Description — match the inline-only rendering from the canvas
  // so the drag preview looks like the real block instead of a generic
  // "question" row.
  if (field.type === 'heading' || field.type === 'description') {
    const align = field.textAlign ?? 'left';
    const isHeading = field.type === 'heading';
    const level = field.headingLevel ?? 'h2';
    const text = field.label || (isHeading ? 'Heading' : 'Add a description…');
    const Tag = isHeading ? level : 'p';

    return (
      <div className="bg-background rounded-md px-3 py-2 opacity-50">
        <div className={cn('leading-tight', TEXT_ALIGN_CLASSES[align])}>
          <Tag
            className={cn(
              'inline-block',
              isHeading ? HEADING_CLASSES[level] : 'text-muted-foreground text-sm leading-relaxed',
            )}
          >
            {text}
          </Tag>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background rounded-md px-3 py-2 opacity-50">
      <div className="flex items-center gap-1.5">
        <FieldTypeIcon type={field.type} className="text-muted-foreground/50 shrink-0" />
        <span className="text-sm font-medium">{field.label || 'Question'}</span>
        {field.required && <span className="text-destructive shrink-0 text-sm">*</span>}
      </div>
      {field.helpText && (
        <p className="text-muted-foreground mt-0.5 pl-0 text-xs">{field.helpText}</p>
      )}
      <div className="pl-0">
        <FieldEditPreview field={field} />
      </div>
    </div>
  );
}
