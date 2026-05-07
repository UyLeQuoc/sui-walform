import type { FormField } from '../../types';
import type { SubmissionRow } from '../hooks/use-form-submissions';
import type { DecryptedRow } from '../hooks/use-submission-decryption';
import { formatCell } from './format-submission-cell';

const ENCRYPTED_PLACEHOLDER = '— encrypted —';

const FORMULA_LEAD_RE = /^[=+\-@\t\r]/;

/**
 * Defuse CSV formula injection (CWE-1236). A submitter who answered a free-
 * text field with `=cmd|'/c calc'!A0` could otherwise execute commands when
 * the creator opens the export in Excel/Sheets. Prepending `'` instructs
 * Excel to render the cell as text.
 *
 * Applied at write time (not at format time) so the in-app rendering still
 * shows the original characters.
 */
function defuseFormula(s: string): string {
  return FORMULA_LEAD_RE.test(s) ? `'${s}` : s;
}

/**
 * Build a CSV string from submission rows. Encrypted rows fall back to a
 * placeholder so the row count stays accurate; only decrypted cells contain
 * the real values.
 */
export function buildSubmissionsCsv(input: {
  rows: SubmissionRow[];
  decryptedById: Record<string, DecryptedRow>;
  fields: FormField[];
}): string {
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
 * Trigger a browser download of `csv` as `${filename}.csv`. Sanitises the
 * filename to ASCII-safe slug. Caller is responsible for passing the form
 * title or another meaningful name.
 */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename.replace(/[^a-z0-9]+/gi, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
