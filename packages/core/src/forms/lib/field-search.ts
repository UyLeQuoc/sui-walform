import { FIELD_TYPES, type FieldTypeMeta } from './field-types';

function isSubsequence(needle: string, haystack: string): boolean {
  let ni = 0;
  for (let i = 0; i < haystack.length && ni < needle.length; i++) {
    if (haystack[i] === needle[ni]) ni++;
  }
  return ni === needle.length;
}

function scoreFieldType(meta: FieldTypeMeta, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const label = meta.label.toLowerCase();
  const desc = meta.description.toLowerCase();

  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.includes(q)) return 60;
  if (desc.startsWith(q)) return 40;
  if (desc.includes(q)) return 20;
  if (isSubsequence(q, label)) return 10;
  if (isSubsequence(q, desc)) return 5;
  return 0;
}

export function filterAndRank(query: string): FieldTypeMeta[] {
  const trimmed = query.trim();
  if (!trimmed) return FIELD_TYPES;
  return FIELD_TYPES.map((meta) => ({
    meta,
    score: scoreFieldType(meta, trimmed),
  }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ meta }) => meta);
}
