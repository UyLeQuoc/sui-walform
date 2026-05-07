/**
 * Drag id prefixes shared between the editor's DnD producers (palette
 * cards, outline rows) and consumer (the FormBuilder DndContext).
 *
 * Centralizing them here keeps the prefix scheme out of UI components
 * and lets the DnD hook depend on plain strings rather than reaching
 * into sibling components.
 */

export const PALETTE_DRAG_PREFIX = 'palette:';
export const OUTLINE_DRAG_PREFIX = 'outline:';

export type DragKind = 'palette' | 'field' | 'outline';

export interface ParsedDragId {
  kind: DragKind;
  /** For `palette`: the field type. For `field`/`outline`: the field id. */
  payload: string;
}

export function parseDragId(rawId: string): ParsedDragId {
  if (rawId.startsWith(PALETTE_DRAG_PREFIX)) {
    return { kind: 'palette', payload: rawId.slice(PALETTE_DRAG_PREFIX.length) };
  }
  if (rawId.startsWith(OUTLINE_DRAG_PREFIX)) {
    return { kind: 'outline', payload: rawId.slice(OUTLINE_DRAG_PREFIX.length) };
  }
  return { kind: 'field', payload: rawId };
}
