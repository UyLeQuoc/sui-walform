import type { FormField } from '../../types';
import type { SubmissionRow } from '../hooks/use-form-submissions';
import type { DecryptedRow } from '../hooks/use-submission-decryption';
import { formatCell } from './format-submission-cell';

const ENCRYPTED_PLACEHOLDER = '— encrypted —';

const FORMULA_LEAD_RE = /^[=+\-@\t\r]/;

export type ExportFormat = 'csv' | 'json' | 'ndjson' | 'markdown';

export interface ExportInput {
  rows: SubmissionRow[];
  decryptedById: Record<string, DecryptedRow>;
  fields: FormField[];
}

/**
 * Defuse CSV formula injection (CWE-1236). A submitter who answered a free-
 * text field with `=cmd|'/c calc'!A0` could otherwise execute commands when
 * the creator opens the export in Excel/Sheets. Prepending `'` instructs
 * Excel to render the cell as text.
 */
function defuseFormula(s: string): string {
  return FORMULA_LEAD_RE.test(s) ? `'${s}` : s;
}

/**
 * Build a CSV string from submission rows. Encrypted rows fall back to a
 * placeholder so the row count stays accurate; only decrypted cells contain
 * the real values.
 */
export function buildSubmissionsCsv(input: ExportInput): string {
  const { rows, decryptedById, fields } = input;
  const header = [
    'submission_id',
    'submitter',
    'submitted_at',
    ...fields.map((f) => f.label || f.id),
  ];
  const csvRows: string[][] = [header];
  for (const row of rows) {
    const decrypted = decryptedById[row.submissionId];
    csvRows.push([
      row.submissionId,
      row.submitter,
      new Date(row.submittedAtMs).toISOString(),
      ...fields.map((f) => formatCell(decrypted?.[f.id] ?? ENCRYPTED_PLACEHOLDER)),
    ]);
  }
  return csvRows
    .map((r) => r.map((c) => `"${defuseFormula(String(c)).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

/**
 * Build a structured JSON export. Each row keeps raw decrypted values so
 * downstream consumers can reason about types (arrays, objects, file refs)
 * instead of the CSV-flattened strings.
 */
export function buildSubmissionsJson(input: ExportInput): string {
  const { rows, decryptedById, fields } = input;
  const payload = rows.map((row) => {
    const decrypted = decryptedById[row.submissionId];
    const answers: Record<string, unknown> = {};
    for (const f of fields) {
      answers[f.label || f.id] = decrypted ? (decrypted[f.id] ?? null) : null;
    }
    return {
      submissionId: row.submissionId,
      submitter: row.submitter,
      submittedAt: new Date(row.submittedAtMs).toISOString(),
      submittedAtMs: row.submittedAtMs,
      encrypted: !decrypted,
      answers,
    };
  });
  return JSON.stringify(payload, null, 2);
}

/**
 * Build NDJSON (newline-delimited JSON) — one row per line. Friendly for
 * streaming ingestion / `jq` pipelines.
 */
export function buildSubmissionsNdjson(input: ExportInput): string {
  const { rows, decryptedById, fields } = input;
  return rows
    .map((row) => {
      const decrypted = decryptedById[row.submissionId];
      const answers: Record<string, unknown> = {};
      for (const f of fields) {
        answers[f.label || f.id] = decrypted ? (decrypted[f.id] ?? null) : null;
      }
      return JSON.stringify({
        submissionId: row.submissionId,
        submitter: row.submitter,
        submittedAt: new Date(row.submittedAtMs).toISOString(),
        encrypted: !decrypted,
        answers,
      });
    })
    .join('\n');
}

function escapeMarkdownCell(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/**
 * Build a Markdown table. Useful for pasting into issues / docs / PRs.
 */
export function buildSubmissionsMarkdown(input: ExportInput): string {
  const { rows, decryptedById, fields } = input;
  const header = [
    'submission_id',
    'submitter',
    'submitted_at',
    ...fields.map((f) => f.label || f.id),
  ];
  const lines: string[] = [];
  lines.push(`| ${header.map(escapeMarkdownCell).join(' | ')} |`);
  lines.push(`| ${header.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    const decrypted = decryptedById[row.submissionId];
    const cells = [
      row.submissionId,
      row.submitter,
      new Date(row.submittedAtMs).toISOString(),
      ...fields.map((f) => formatCell(decrypted?.[f.id] ?? ENCRYPTED_PLACEHOLDER)),
    ];
    lines.push(`| ${cells.map((c) => escapeMarkdownCell(String(c))).join(' | ')} |`);
  }
  return lines.join('\n');
}

const FORMAT_META: Record<ExportFormat, { ext: string; mime: string }> = {
  csv: { ext: 'csv', mime: 'text/csv' },
  json: { ext: 'json', mime: 'application/json' },
  ndjson: { ext: 'ndjson', mime: 'application/x-ndjson' },
  markdown: { ext: 'md', mime: 'text/markdown' },
};

export function buildSubmissionsExport(format: ExportFormat, input: ExportInput): string {
  switch (format) {
    case 'csv':
      return buildSubmissionsCsv(input);
    case 'json':
      return buildSubmissionsJson(input);
    case 'ndjson':
      return buildSubmissionsNdjson(input);
    case 'markdown':
      return buildSubmissionsMarkdown(input);
  }
}

/**
 * Trigger a browser download of `content` as `${filename}.${ext}`. Sanitises
 * the filename to an ASCII-safe slug.
 */
export function downloadExport(content: string, filename: string, format: ExportFormat): void {
  const { ext, mime } = FORMAT_META[format];
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename.replace(/[^a-z0-9]+/gi, '-')}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @deprecated use `downloadExport(csv, name, 'csv')` instead. Kept for
 * existing callers.
 */
export function downloadCsv(csv: string, filename: string): void {
  downloadExport(csv, filename, 'csv');
}
