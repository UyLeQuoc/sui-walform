'use client';

import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';
import type { FieldType, FormField } from '../../types';
import { FIELD_TYPES, type FieldTypeMeta } from '../lib/field-types';
import { OUTLINE_DRAG_PREFIX, parseDragId, type DragKind } from '../lib/drag-ids';
import { useFormBuilderStore } from '../store/form-builder-store';

export interface ActiveDrag {
  kind: DragKind;
  payload: string;
}

export interface UseFormBuilderDndResult {
  sensors: ReturnType<typeof useSensors>;
  activeDrag: ActiveDrag | null;
  paletteDropIndex: number | null;
  isPaletteDragging: boolean;
  /** The field currently being reordered on the canvas (kind === 'field'). */
  activeField: FormField | null;
  /** The field being dragged from the outline (kind === 'outline'). */
  activeOutlineField: FormField | null;
  /** Palette card metadata for the field type currently being dragged. */
  activePaletteMeta: FieldTypeMeta | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

/**
 * All drag-and-drop state and handlers for the FormBuilder canvas.
 *
 * Three drag sources flow through one DndContext:
 *   - palette card → insert a new field at `paletteDropIndex`
 *   - canvas field → reorder
 *   - outline row  → reorder
 *
 * Drop ids `form-card` and `form-card-end` are recognized as "drop at end"
 * targets used by the FormCard wrapper.
 */
export function useFormBuilderDnd(): UseFormBuilderDndResult {
  const fields = useFormBuilderStore((s) => s.schema.fields);
  const reorderFields = useFormBuilderStore((s) => s.reorderFields);
  const addFieldAt = useFormBuilderStore((s) => s.addFieldAt);

  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [paletteDropIndex, setPaletteDropIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const parsed = parseDragId(String(event.active.id));
    setActiveDrag(parsed);
    if (parsed.kind === 'palette') {
      setPaletteDropIndex(fields.length);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const parsed = parseDragId(String(active.id));
    if (parsed.kind !== 'palette') return;

    const overId = String(over.id);
    if (overId === 'form-card' || overId === 'form-card-end') {
      setPaletteDropIndex(fields.length);
      return;
    }

    const overIndex = fields.findIndex((f) => f.id === overId);
    if (overIndex === -1) return;
    setPaletteDropIndex(overIndex);
  };

  const reset = () => {
    setActiveDrag(null);
    setPaletteDropIndex(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const parsed = parseDragId(String(active.id));

    if (parsed.kind === 'palette') {
      const dropIndex = paletteDropIndex ?? fields.length;
      if (over) {
        addFieldAt(parsed.payload as FieldType, dropIndex);
      }
      reset();
      return;
    }

    if (parsed.kind === 'outline') {
      reset();
      if (!over) return;
      const overId = String(over.id);
      if (!overId.startsWith(OUTLINE_DRAG_PREFIX)) return;
      const fromId = parsed.payload;
      const toId = overId.slice(OUTLINE_DRAG_PREFIX.length);
      if (fromId === toId) return;
      const fromIndex = fields.findIndex((f) => f.id === fromId);
      const toIndex = fields.findIndex((f) => f.id === toId);
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        reorderFields(fromIndex, toIndex);
      }
      return;
    }

    // Canvas reorder
    reset();
    if (!over || active.id === over.id) return;
    const fromIndex = fields.findIndex((f) => f.id === active.id);
    if (fromIndex === -1) return;

    const overId = String(over.id);
    let toIndex: number;
    if (overId === 'form-card-end' || overId === 'form-card') {
      toIndex = fields.length - 1;
    } else if (overId.startsWith(OUTLINE_DRAG_PREFIX)) {
      toIndex = fields.findIndex((f) => f.id === overId.slice(OUTLINE_DRAG_PREFIX.length));
    } else {
      toIndex = fields.findIndex((f) => f.id === overId);
    }
    if (toIndex !== -1 && toIndex !== fromIndex) {
      reorderFields(fromIndex, toIndex);
    }
  };

  const activeField = useMemo(() => {
    if (!activeDrag || activeDrag.kind !== 'field') return null;
    return fields.find((f) => f.id === activeDrag.payload) ?? null;
  }, [activeDrag, fields]);

  const activeOutlineField = useMemo(() => {
    if (!activeDrag || activeDrag.kind !== 'outline') return null;
    return fields.find((f) => f.id === activeDrag.payload) ?? null;
  }, [activeDrag, fields]);

  const activePaletteMeta = useMemo(() => {
    if (!activeDrag || activeDrag.kind !== 'palette') return null;
    return FIELD_TYPES.find((m) => m.type === activeDrag.payload) ?? null;
  }, [activeDrag]);

  return {
    sensors,
    activeDrag,
    paletteDropIndex,
    isPaletteDragging: activeDrag?.kind === 'palette',
    activeField,
    activeOutlineField,
    activePaletteMeta,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel: reset,
  };
}
