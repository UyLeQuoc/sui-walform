import type { FormField } from '../../types';
import { FIELD_TYPES } from './field-types';

const NON_INPUT_TYPES = new Set<FormField['type']>([
  'heading',
  'description',
  'markdown',
  'divider',
  'space',
]);

/**
 * Counts derived from the form's fields for the outline header.
 * `inputs` includes any field that produces a value at submit time;
 * `sections` is the count of `heading` blocks.
 */
export function countOutlineKinds(fields: FormField[]): {
  inputs: number;
  sections: number;
} {
  let inputs = 0;
  let sections = 0;
  for (const f of fields) {
    if (!NON_INPUT_TYPES.has(f.type)) inputs++;
    if (f.type === 'heading') sections++;
  }
  return { inputs, sections };
}

/**
 * The label shown for a field row in the outline. Layout-only types
 * with no editable label (divider, space) get a synthesized label;
 * everything else falls back to the field-type meta label.
 */
export function getOutlineLabel(field: FormField): string {
  if (field.type === 'divider') return 'Divider';
  if (field.type === 'space') return `Space · ${field.height ?? 32}px`;
  const trimmed = field.label?.trim();
  if (trimmed && trimmed.length > 0) return trimmed;
  return FIELD_TYPES.find((m) => m.type === field.type)?.label ?? 'Untitled';
}
