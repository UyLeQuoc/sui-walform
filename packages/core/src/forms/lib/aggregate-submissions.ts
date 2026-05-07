import type { FormField } from '../../types';

export interface AggregateBucket {
  label: string;
  count: number;
}

const CHART_FIELD_TYPES = new Set<FormField['type']>([
  'single_choice',
  'multiple_choice',
  'select',
  'yes_no',
  'rating',
  'linear_scale',
]);

/**
 * True iff this field type makes sense to render as an aggregate bar chart
 * on the Results dashboard. Free-text + layout fields are excluded.
 */
export function isChartableField(field: FormField): boolean {
  return CHART_FIELD_TYPES.has(field.type);
}

/**
 * Group decrypted-submission rows into bucket counts for one field. Buckets
 * are pre-seeded from the field's option/scale definition so empty
 * categories still render and the order matches the form definition.
 */
export function bucketize(field: FormField, rows: Record<string, unknown>[]): AggregateBucket[] {
  const counts = new Map<string, number>();

  if (
    field.type === 'single_choice' ||
    field.type === 'multiple_choice' ||
    field.type === 'select'
  ) {
    for (const opt of field.options ?? []) counts.set(opt.label || opt.value, 0);
  } else if (field.type === 'yes_no') {
    counts.set('Yes', 0);
    counts.set('No', 0);
  } else if (field.type === 'rating') {
    const max = field.validation?.max ?? 5;
    for (let i = 1; i <= max; i++) counts.set(String(i), 0);
  } else if (field.type === 'linear_scale') {
    const from = field.validation?.scaleFrom ?? 1;
    const to = field.validation?.scaleTo ?? 5;
    const jump = field.validation?.scaleJump ?? 1;
    for (let n = from; n <= to; n += jump) counts.set(String(n), 0);
  }

  for (const row of rows) {
    const value = row[field.id];
    if (value === null || value === undefined || value === '') continue;
    for (const label of pickLabels(field, value)) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
}

function pickLabels(field: FormField, value: unknown): string[] {
  if (field.type === 'multiple_choice' && Array.isArray(value)) {
    return value.map((v) => labelForOption(field, String(v)));
  }
  if (field.type === 'single_choice' || field.type === 'select') {
    return [labelForOption(field, String(value))];
  }
  if (field.type === 'yes_no') {
    const s = String(value).toLowerCase();
    return [s === 'yes' ? 'Yes' : s === 'no' ? 'No' : String(value)];
  }
  // rating + linear_scale — coerce to integer bucket label.
  const n = Number(value);
  return [Number.isFinite(n) ? String(Math.round(n)) : String(value)];
}

function labelForOption(field: FormField, raw: string): string {
  const match = (field.options ?? []).find((o) => o.value === raw);
  return match?.label || raw;
}
