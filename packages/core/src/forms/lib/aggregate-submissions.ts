import { isFileAttachmentValue } from './file-attachment';
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
  /** Numeric average for rating / linear_scale / number. NaN otherwise. */
  average: number;
  /** Min/max/median for numeric-y fields. All NaN when not applicable. */
  min: number;
  max: number;
  median: number;
}

export interface FileSummary {
  totalFiles: number;
  totalBytes: number;
}

/**
 * Per-field viz variant. Drives which chart `AggregateCharts` renders.
 * Selection types fall into 'pie' (≤4 mutually-exclusive options) or 'hbar'.
 * Ordinal scales ('rating', 'linear_scale') use 'histogram' with even buckets
 * pre-seeded so empty bars stay visible. Number fields get a numeric summary
 * card. Dates get a daily histogram. Long-text gets keyword extraction.
 */
export type ChartVariant =
  | 'pie'
  | 'hbar'
  | 'histogram'
  | 'numeric'
  | 'date'
  | 'top-text'
  | 'keywords'
  | 'files';

const CHOICE_FIELD_TYPES = new Set<FormField['type']>([
  'single_choice',
  'multiple_choice',
  'select',
  'yes_no',
  'rating',
  'linear_scale',
]);

const TEXT_FIELD_TYPES = new Set<FormField['type']>([
  'short_text',
  'email',
  'phone',
  'url',
]);

export function isChartableField(field: FormField): boolean {
  if (CHOICE_FIELD_TYPES.has(field.type)) return true;
  if (field.type === 'number') return true;
  if (field.type === 'date' || field.type === 'time') return true;
  return false;
}

export function isTextField(field: FormField): boolean {
  return TEXT_FIELD_TYPES.has(field.type);
}

export function isLongTextField(field: FormField): boolean {
  return field.type === 'long_text';
}

export function isFileField(field: FormField): boolean {
  return field.type === 'file';
}

/**
 * Pick the best viz for a field.
 *  - single_choice ≤4 / yes_no → pie (mutually exclusive, few buckets)
 *  - select / single_choice >4 → hbar (long option lists read better as bars)
 *  - multiple_choice → hbar (independent buckets, % > 100 is meaningful)
 *  - rating / linear_scale → histogram (ordinal axis)
 *  - number → numeric stats (mean/median/range + mini-histogram)
 *  - date / time → date-bucket histogram
 *  - short_text / email / phone / url → top-text frequency list
 *  - long_text → keyword cloud (top tokens)
 *  - file → file count + thumbs
 */
export function chartVariantFor(field: FormField): ChartVariant {
  if (field.type === 'yes_no') return 'pie';
  if (field.type === 'single_choice' && (field.options?.length ?? 0) <= 4) return 'pie';
  if (field.type === 'rating' || field.type === 'linear_scale') return 'histogram';
  if (field.type === 'number') return 'numeric';
  if (field.type === 'date' || field.type === 'time') return 'date';
  if (TEXT_FIELD_TYPES.has(field.type)) return 'top-text';
  if (field.type === 'long_text') return 'keywords';
  if (field.type === 'file') return 'files';
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
 * Skip = decrypted row had this id missing or empty.
 */
export function summarizeField(field: FormField, rows: Record<string, unknown>[]): FieldSummary {
  let answered = 0;
  const numerics: number[] = [];
  for (const row of rows) {
    const value = row[field.id];
    if (isEmpty(value)) continue;
    answered++;
    if (field.type === 'rating' || field.type === 'linear_scale' || field.type === 'number') {
      const n = Number(value);
      if (Number.isFinite(n)) numerics.push(n);
    }
  }
  let avg = Number.NaN;
  let min = Number.NaN;
  let max = Number.NaN;
  let median = Number.NaN;
  if (numerics.length > 0) {
    const sorted = [...numerics].sort((a, b) => a - b);
    avg = sorted.reduce((s, n) => s + n, 0) / sorted.length;
    min = sorted[0]!;
    max = sorted[sorted.length - 1]!;
    const mid = Math.floor(sorted.length / 2);
    median = sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  }
  return {
    answered,
    skipped: rows.length - answered,
    average: avg,
    min,
    max,
    median,
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
 * Bucket numeric responses into a tidy ~10-bin histogram. When all values
 * are integers within a small range (≤20 distinct), each integer gets its
 * own bin instead of a synthetic range — looks more natural for things like
 * "how many people in your team".
 */
export function numericHistogram(
  field: FormField,
  rows: Record<string, unknown>[],
): AggregateBucket[] {
  const values: number[] = [];
  for (const row of rows) {
    const v = row[field.id];
    if (isEmpty(v)) continue;
    const n = Number(v);
    if (Number.isFinite(n)) values.push(n);
  }
  if (values.length === 0) return [];

  const allInt = values.every((n) => Number.isInteger(n));
  const distinct = new Set(values).size;
  if (allInt && distinct <= 20) {
    const counts = new Map<number, number>();
    const min = Math.min(...values);
    const max = Math.max(...values);
    for (let n = min; n <= max; n++) counts.set(n, 0);
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    return Array.from(counts.entries()).map(([k, c]) => ({ label: String(k), count: c }));
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const bins = 10;
  const width = (max - min) / bins || 1;
  const buckets: AggregateBucket[] = [];
  for (let i = 0; i < bins; i++) {
    const lo = min + i * width;
    const hi = i === bins - 1 ? max : lo + width;
    buckets.push({ label: formatRange(lo, hi), count: 0 });
  }
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    buckets[idx]!.count++;
  }
  return buckets;
}

function formatRange(lo: number, hi: number): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return `${fmt(lo)}–${fmt(hi)}`;
}

/**
 * Daily/weekly buckets for date or time fields. Returns chronologically
 * sorted buckets keyed by ISO day. Time-only fields bucket by hour instead.
 */
export function dateHistogram(
  field: FormField,
  rows: Record<string, unknown>[],
): AggregateBucket[] {
  if (field.type === 'time') {
    const counts = new Map<string, number>();
    for (let h = 0; h < 24; h++) counts.set(`${h.toString().padStart(2, '0')}:00`, 0);
    for (const row of rows) {
      const v = row[field.id];
      if (isEmpty(v) || typeof v !== 'string') continue;
      const [hStr] = v.split(':');
      const h = Number(hStr);
      if (Number.isFinite(h) && h >= 0 && h < 24) {
        const k = `${h.toString().padStart(2, '0')}:00`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
  }

  // Date field — bucket by ISO day.
  const days = new Map<string, number>();
  for (const row of rows) {
    const v = row[field.id];
    if (isEmpty(v) || typeof v !== 'string') continue;
    const d = v.slice(0, 10);
    days.set(d, (days.get(d) ?? 0) + 1);
  }
  return Array.from(days.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([label, count]) => ({ label, count }));
}

/**
 * Aggregate file responses across rows. Each value is either an object
 * `{name, url, sizeBytes}` (matches our file-attachment shape) or null.
 */
export function fileSummary(
  field: FormField,
  rows: Record<string, unknown>[],
): FileSummary {
  let count = 0;
  let bytes = 0;
  for (const row of rows) {
    const v = row[field.id];
    if (!v) continue;
    if (isFileAttachmentValue(v)) {
      count++;
      if (typeof v.size === 'number') bytes += v.size;
    } else if (typeof v === 'string' && v) {
      count++;
    }
  }
  return { totalFiles: count, totalBytes: bytes };
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

// English stopword list — small but covers the noise that dominates a naive
// frequency count over short paragraphs. Not internationalised; long-text
// keyword extraction is best-effort signal, not analytics.
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has', 'have',
  'he', 'i', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'so', 'that', 'the', 'this',
  'to', 'was', 'were', 'will', 'with', 'you', 'your', 'we', 'our', 'they', 'them',
  'their', 'do', 'does', 'did', 'not', 'no', 'yes', 'if', 'then', 'than', 'just',
  'me', 'my', 'us', 'am', 'been', 'being', 'because', 'about', 'into', 'over',
  'all', 'any', 'some', 'more', 'most', 'such', 'only', 'own', 'same', 'too', 'very',
  'can', 'could', 'should', 'would', 'also', 'how', 'what', 'when', 'where', 'why',
  'who', 'which', 'there', 'here', 'now', 'one', 'two', 'three', 'get', 'got',
]);

/**
 * Top-N tokens for long-form text answers. Lowercases, strips punctuation,
 * drops short tokens + English stopwords, then ranks by frequency. Intended
 * as a lightweight "what are people saying" signal — not a real NLP step.
 */
export function topKeywords(
  field: FormField,
  rows: Record<string, unknown>[],
  limit = 12,
): AggregateBucket[] {
  if (!isLongTextField(field)) return [];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const v = row[field.id];
    if (typeof v !== 'string') continue;
    const tokens = v
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s'-]+/gu, ' ')
      .split(/\s+/);
    for (const t of tokens) {
      if (t.length < 3) continue;
      if (STOPWORDS.has(t)) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
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
