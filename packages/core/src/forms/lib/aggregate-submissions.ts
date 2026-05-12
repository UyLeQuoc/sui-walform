import type { FormField } from '../../types';

export interface AggregateBucket {
  label: string;
  count: number;
}

export interface FieldSummary {
  /** Rows where this field had a non-empty value. */
  answered: number;
  /** Rows where this field was blank/skipped. */
  skipped: number;
  /** Numeric average for rating / linear_scale. NaN otherwise. */
  average: number;
}

const CHART_FIELD_TYPES = new Set<FormField['type']>([
  'single_choice',
  'multiple_choice',
  'select',
  'yes_no',
  'rating',
  'linear_scale',
]);

const TEXT_FIELD_TYPES = new Set<FormField['type']>([
  'short_text',
  'long_text',
  'email',
  'phone',
  'url',
]);

export function isChartableField(field: FormField): boolean {
  return CHART_FIELD_TYPES.has(field.type);
}

export function isTextField(field: FormField): boolean {
  return TEXT_FIELD_TYPES.has(field.type);
}

/**
 * Pick the best chart variant for a chartable field. Donut reads better for
 * 2–4 mutually-exclusive options; horizontal bars handle longer option lists
 * and multi-select; histogram is the natural shape for ordinal scales.
 */
export function chartVariantFor(
  field: FormField,
): 'donut' | 'hbar' | 'histogram' {
  if (field.type === 'yes_no') return 'donut';
  if (field.type === 'single_choice' && (field.options?.length ?? 0) <= 4) return 'donut';
  if (field.type === 'rating' || field.type === 'linear_scale') return 'histogram';
  return 'hbar';
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Per-field response/skip counts + numeric average where it makes sense.
 * Skip = decrypted row had this id missing or empty. Layout-only fields
 * (heading, divider, etc.) should never reach this function — gate at the
 * caller via `isInputField`.
 */
export function summarizeField(field: FormField, rows: Record<string, unknown>[]): FieldSummary {
  let answered = 0;
  let sum = 0;
  let numericCount = 0;
  for (const row of rows) {
    const value = row[field.id];
    if (isEmpty(value)) continue;
    answered++;
    if (field.type === 'rating' || field.type === 'linear_scale') {
      const n = Number(value);
      if (Number.isFinite(n)) {
        sum += n;
        numericCount++;
      }
    }
  }
  return {
    answered,
    skipped: rows.length - answered,
    average: numericCount > 0 ? sum / numericCount : Number.NaN,
  };
}

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
    if (isEmpty(value)) continue;
    for (const label of pickLabels(field, value)) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
}

/**
 * Top-N most frequent answers for free-text fields. Trims and case-folds for
 * grouping so "Yes" and "yes " count together — the displayed label keeps
 * the first form observed.
 */
export function topTextAnswers(
  field: FormField,
  rows: Record<string, unknown>[],
  limit = 5,
): AggregateBucket[] {
  if (!isTextField(field)) return [];
  const counts = new Map<string, { label: string; count: number }>();
  for (const row of rows) {
    const value = row[field.id];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    const entry = counts.get(key);
    if (entry) {
      entry.count++;
    } else {
      counts.set(key, { label: trimmed, count: 1 });
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
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
