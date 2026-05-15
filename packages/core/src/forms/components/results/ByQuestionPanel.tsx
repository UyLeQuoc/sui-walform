'use client';

import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { Table, TableBody, TableCell, TableRow } from '../../../ui/table';
import { shortAddr } from '../../lib/format-address';
import { formatCell } from '../../lib/format-submission-cell';
import { isFileAttachmentValue } from '../../lib/file-attachment';
import { summarizeField } from '../../lib/aggregate-submissions';
import type { SubmissionRow } from '../../hooks/use-form-submissions';
import type { FormField } from '../../../types';
import { FieldViz, FieldStatLine } from './AggregateCharts';
import { FileAttachmentView } from './FileAttachmentView';

interface ByQuestionPanelProps {
  fields: FormField[];
  submissionRows: SubmissionRow[];
  decryptedById: Record<string, Record<string, unknown>>;
}

/**
 * Question-by-question deep dive — third tab on the Results dashboard.
 * Mirrors Google Forms' "Question" sub-tab: navigate one question at a time
 * with its full distribution (chart + stats) and every answer below.
 *
 * Built on top of `FieldViz` + `FieldStatLine` from `AggregateCharts` so the
 * per-type rendering stays single-source-of-truth.
 */
export function ByQuestionPanel({
  fields,
  submissionRows,
  decryptedById,
}: ByQuestionPanelProps) {
  const [index, setIndex] = useState(0);

  if (fields.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground text-sm">
            This form has no input questions to analyze.
          </p>
        </CardContent>
      </Card>
    );
  }

  const decryptedRows = submissionRows
    .map((r) => decryptedById[r.submissionId])
    .filter((d): d is Record<string, unknown> => !!d);

  const field = fields[Math.min(index, fields.length - 1)]!;
  const summary = summarizeField(field, decryptedRows);
  const total = decryptedRows.length;
  const skipPct = total === 0 ? 0 : Math.round((summary.skipped / total) * 100);

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(fields.length - 1, i + 1));

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            disabled={index === 0}
            onClick={goPrev}
            aria-label="Previous question"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            Question {index + 1} of {fields.length}
          </span>
          <div className="min-w-[12rem] flex-1">
            <Select value={String(index)} onValueChange={(v) => setIndex(Number(v))}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fields.map((f, i) => (
                  <SelectItem key={f.id} value={String(i)} className="text-xs">
                    {i + 1}. {f.label || f.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            disabled={index >= fields.length - 1}
            onClick={goNext}
            aria-label="Next question"
          >
            <ChevronRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold">{field.label || field.id}</h3>
            <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
              {field.type.replace(/_/g, ' ')}
              {field.required && ' · required'}
            </span>
          </div>
          {field.helpText && (
            <p className="text-muted-foreground text-xs">{field.helpText}</p>
          )}
          <FieldStatLine field={field} summary={summary} skipPct={skipPct} />
          <FieldViz field={field} rows={decryptedRows} answered={summary.answered} />
        </CardContent>
      </Card>

      <AllAnswersList
        field={field}
        submissionRows={submissionRows}
        decryptedById={decryptedById}
      />
    </div>
  );
}

interface AllAnswersListProps {
  field: FormField;
  submissionRows: SubmissionRow[];
  decryptedById: Record<string, Record<string, unknown>>;
}

function AllAnswersList({
  field,
  submissionRows,
  decryptedById,
}: AllAnswersListProps) {
  const entries = submissionRows.map((row) => {
    const decrypted = decryptedById[row.submissionId];
    return {
      submissionId: row.submissionId,
      submitter: row.submitter,
      submittedAtMs: row.submittedAtMs,
      value: decrypted ? decrypted[field.id] : undefined,
      decrypted: !!decrypted,
    };
  });
  const answered = entries.filter((e) => e.decrypted && !isEmptyValue(e.value));
  const skipped = entries.filter((e) => e.decrypted && isEmptyValue(e.value));
  const encrypted = entries.filter((e) => !e.decrypted);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-medium">All answers</h4>
          <span className="text-muted-foreground text-xs">
            {answered.length} answered
            {skipped.length > 0 && ` · ${skipped.length} skipped`}
            {encrypted.length > 0 && ` · ${encrypted.length} encrypted`}
          </span>
        </div>
        {answered.length === 0 && encrypted.length === 0 && skipped.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">
            No responses yet.
          </p>
        ) : (
          <Table className="text-sm">
            <TableBody>
              {answered.map((e) => (
                <TableRow key={e.submissionId}>
                  <TableCell className="w-36 align-top text-xs whitespace-nowrap">
                    <code className="font-mono">{shortAddr(e.submitter)}</code>
                    <div className="text-muted-foreground mt-0.5 text-[10px]">
                      {new Date(e.submittedAtMs).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell className="align-top break-words whitespace-normal">
                    {renderAnswer(field, e.value)}
                  </TableCell>
                </TableRow>
              ))}
              {skipped.map((e) => (
                <TableRow key={e.submissionId}>
                  <TableCell className="w-36 align-top text-xs whitespace-nowrap">
                    <code className="font-mono">{shortAddr(e.submitter)}</code>
                  </TableCell>
                  <TableCell className="text-muted-foreground/60 align-top text-xs italic">
                    — skipped —
                  </TableCell>
                </TableRow>
              ))}
              {encrypted.map((e) => (
                <TableRow key={e.submissionId}>
                  <TableCell className="w-36 align-top text-xs whitespace-nowrap">
                    <code className="font-mono">{shortAddr(e.submitter)}</code>
                  </TableCell>
                  <TableCell className="text-muted-foreground/60 align-top text-xs italic">
                    — encrypted — decrypt to view
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function renderAnswer(field: FormField, value: unknown): ReactNode {
  if (isEmptyValue(value)) {
    return <span className="text-muted-foreground/60 text-xs italic">— not answered —</span>;
  }
  if (field.type === 'file' || isFileAttachmentValue(value)) {
    return <FileAttachmentView value={value} />;
  }
  return formatCell(value);
}
