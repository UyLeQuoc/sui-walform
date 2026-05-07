'use client';

import { GripVertical } from 'lucide-react';
import type { FormField } from '../../../types';
import type { FieldTypeMeta } from '../../lib/field-types';
import { FieldBlockGhost } from './FieldBlockGhost';
import { FieldTypeIcon } from '../FieldTypeIcon';

interface FormBuilderDragOverlayProps {
  activeField: FormField | null;
  activeOutlineField: FormField | null;
  activePaletteMeta: FieldTypeMeta | null;
}

/**
 * Renders the floating preview that follows the pointer during a drag.
 * Picks one of three silhouettes based on which drag source is active —
 * canvas-field reorder, outline-row reorder, or palette-card insert.
 */
export function FormBuilderDragOverlay({
  activeField,
  activeOutlineField,
  activePaletteMeta,
}: FormBuilderDragOverlayProps) {
  if (activeField) return <FieldBlockGhost field={activeField} />;

  if (activeOutlineField) {
    return (
      <div className="bg-background flex items-center gap-2 rounded-md py-1.5 pr-2 pl-0 text-sm opacity-50">
        {/* Matches the grip column in OverviewRow so the ghost keeps the
            row's silhouette instead of collapsing to just icon + label. */}
        <span className="text-muted-foreground/40 flex w-4 shrink-0 items-center justify-center">
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <FieldTypeIcon
          type={activeOutlineField.type}
          className="text-muted-foreground/80 h-3.5 w-3.5 shrink-0"
        />
        <span className="truncate font-medium">
          {activeOutlineField.label?.trim() || 'Untitled'}
        </span>
      </div>
    );
  }

  if (activePaletteMeta) {
    return (
      <div className="bg-card flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm shadow-lg">
        <span className="bg-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
          <FieldTypeIcon type={activePaletteMeta.type} className="h-4 w-4" />
        </span>
        <span className="font-medium">{activePaletteMeta.label}</span>
      </div>
    );
  }

  return null;
}
