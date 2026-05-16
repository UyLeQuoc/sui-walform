'use client';

import { useState, type ReactNode } from 'react';
import { BarChart3, Maximize2 } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../../ui/chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Table, TableBody, TableCell, TableRow } from '../../../ui/table';
import { Paperclip } from 'lucide-react';
import { shortAddr } from '../../lib/format-address';
import { formatCell } from '../../lib/format-submission-cell';
import { coerceFileAttachment, isFileAttachmentValue } from '../../lib/file-attachment';
import type { SubmissionRow } from '../../hooks/use-form-submissions';
import {
  bucketize,
  chartVariantFor,
  dateHistogram,
  fileSummary,
  isChartableField,
  isFileField,
  isLongTextField,
  isTextField,
  numericHistogram,
  summarizeField,
  topKeywords,
  topTextAnswers,
  type AggregateBucket,
  type FieldSummary,
} from '../../lib/aggregate-submissions';
import type { FormField } from '../../../types';

const PALETTE = [
  'var(--chart-1, hsl(220 70% 50%))',
  'var(--chart-2, hsl(160 70% 45%))',
  'var(--chart-3, hsl(40 90% 55%))',
  'var(--chart-4, hsl(280 70% 60%))',
  'var(--chart-5, hsl(0 75% 60%))',
  'var(--chart-6, hsl(190 70% 50%))',
];

const CHART_CONFIG: ChartConfig = {
  count: { label: 'Responses', color: PALETTE[0] },
};

interface AggregateChartsProps {
  fields: FormField[];
  decryptedRows: Record<string, unknown>[];
  /** Optional — when provided, each card gains an "All answers" dialog
   * showing every submitter's response to that field. */
  submissionRows?: SubmissionRow[];
  decryptedById?: Record<string, Record<string, unknown>>;
}

export function AggregateCharts({
  fields,
  decryptedRows,
  submissionRows,
  decryptedById,
}: AggregateChartsProps) {
  const summarizable = fields.filter(
    (f) => isChartableField(f) || isTextField(f) || isLongTextField(f) || isFileField(f),
  );
  if (summarizable.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {summarizable.map((field) => (
        <FieldCard
          key={field.id}
          field={field}
          rows={decryptedRows}
          submissionRows={submissionRows}
          decryptedById={decryptedById}
        />
      ))}
    </div>
  );
}

interface FieldCardProps {
  field: FormField;
  rows: Record<string, unknown>[];
  submissionRows?: SubmissionRow[];
  decryptedById?: Record<string, Record<string, unknown>>;
}

function FieldCard({ field, rows, submissionRows, decryptedById }: FieldCardProps) {
  const summary = summarizeField(field, rows);
  const total = rows.length;
  const skipPct = total === 0 ? 0 : Math.round((summary.skipped / total) * 100);
  const [allOpen, setAllOpen] = useState(false);
  const canShowAll = !!submissionRows && !!decryptedById;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="line-clamp-1 text-sm font-medium">{field.label || field.id}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
              {field.type.replace(/_/g, ' ')}
            </span>
            {canShowAll && (
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                onClick={() => setAllOpen(true)}
                aria-label="View all answers"
              >
                <Maximize2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
        <FieldStatLine field={field} summary={summary} skipPct={skipPct} />
        <FieldViz field={field} rows={rows} answered={summary.answered} />
      </CardContent>
      {canShowAll && (
        <AllAnswersDialog
          open={allOpen}
          onOpenChange={setAllOpen}
          field={field}
          submissionRows={submissionRows!}
          decryptedById={decryptedById!}
        />
      )}
    </Card>
  );
}

export function FieldStatLine({
  field,
  summary,
  skipPct,
}: {
  field: FormField;
  summary: FieldSummary;
  skipPct: number;
}) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      <span>
        <span className="text-foreground font-medium tabular-nums">{summary.answered}</span>{' '}
        answered
      </span>
      {summary.skipped > 0 && (
        <span>
          <span className="text-foreground tabular-nums">{summary.skipped}</span> skipped (
          {skipPct}%)
        </span>
      )}
      {Number.isFinite(summary.average) && (
        <span>
          avg{' '}
          <span className="text-foreground font-medium tabular-nums">
            {summary.average.toFixed(field.type === 'number' ? 2 : 1)}
          </span>
        </span>
      )}
      {field.type === 'number' && Number.isFinite(summary.median) && (
        <>
          <span>
            median{' '}
            <span className="text-foreground tabular-nums">{summary.median.toFixed(2)}</span>
          </span>
          <span>
            range{' '}
            <span className="text-foreground tabular-nums">
              {summary.min.toFixed(2)}–{summary.max.toFixed(2)}
            </span>
          </span>
        </>
      )}
    </div>
  );
}

interface AllAnswersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: FormField;
  submissionRows: SubmissionRow[];
  decryptedById: Record<string, Record<string, unknown>>;
}

function AllAnswersDialog({
  open,
  onOpenChange,
  field,
  submissionRows,
  decryptedById,
}: AllAnswersDialogProps) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{field.label || field.id}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>
              <span className="text-foreground font-medium tabular-nums">{answered.length}</span>{' '}
              answered
            </span>
            {skipped.length > 0 && (
              <span>
                <span className="text-foreground tabular-nums">{skipped.length}</span> skipped
              </span>
            )}
            {encrypted.length > 0 && (
              <span>
                <span className="text-foreground tabular-nums">{encrypted.length}</span> still
                encrypted
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {answered.length === 0 && encrypted.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No answers for this question yet.
          </p>
        ) : (
          <Table className="text-sm">
            <TableBody>
              {answered.map((e) => (
                <TableRow key={e.submissionId}>
                  <TableCell className="w-32 align-top text-xs whitespace-nowrap">
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
                  <TableCell className="w-32 align-top text-xs whitespace-nowrap">
                    <code className="font-mono">{shortAddr(e.submitter)}</code>
                  </TableCell>
                  <TableCell className="text-muted-foreground/60 align-top text-xs italic">
                    — skipped —
                  </TableCell>
                </TableRow>
              ))}
              {encrypted.map((e) => (
                <TableRow key={e.submissionId}>
                  <TableCell className="w-32 align-top text-xs whitespace-nowrap">
                    <code className="font-mono">{shortAddr(e.submitter)}</code>
                  </TableCell>
                  <TableCell className="text-muted-foreground/60 align-top text-xs italic">
                    — encrypted — decrypt this submission to view the answer
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
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
    return <FilePlaceholder value={value} />;
  }
  return formatCell(value);
}

/**
 * Summary-tab file placeholder — names only, no preview/download. Full file
 * content (image preview, download links) is reserved for the Individual tab.
 */
function FilePlaceholder({ value }: { value: unknown }) {
  const attachment = coerceFileAttachment(value);
  return (
    <div className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
      <Paperclip className="size-3" />
      <span className="font-medium">{attachment?.name ?? 'Attached file'}</span>
      <span className="text-muted-foreground/70 italic">— view in Individual tab</span>
    </div>
  );
}

interface FieldVizProps {
  field: FormField;
  rows: Record<string, unknown>[];
  answered: number;
}

/**
 * Variant dispatch — every input type lands on its best chart:
 *  pie       single_choice ≤4 / yes_no
 *  hbar      single_choice >4 / multiple_choice / select
 *  histogram rating / linear_scale
 *  numeric   number (mini-histogram + min/median/avg/max in stat line)
 *  date      date / time (chronological area chart)
 *  top-text  email / phone / url / short_text (frequency list)
 *  keywords  long_text (token frequency cloud)
 *  files     file (count + sample thumbs)
 */
export function FieldViz({ field, rows, answered }: FieldVizProps) {
  const variant = chartVariantFor(field);

  if (variant === 'top-text') {
    const top = topTextAnswers(field, rows);
    if (top.length === 0) return <EmptyHint>No text responses yet</EmptyHint>;
    return <TextTopList items={top} total={answered} />;
  }
  if (variant === 'keywords') {
    const tokens = topKeywords(field, rows);
    if (tokens.length === 0) return <EmptyHint>No text responses yet</EmptyHint>;
    return <KeywordCloud items={tokens} />;
  }
  if (variant === 'files') {
    const sum = fileSummary(field, rows);
    if (sum.totalFiles === 0) return <EmptyHint>No files uploaded yet</EmptyHint>;
    return <FilesSummary field={field} rows={rows} summary={sum} />;
  }
  if (variant === 'numeric') {
    const buckets = numericHistogram(field, rows);
    if (buckets.length === 0) return <EmptyHint>No numeric responses yet</EmptyHint>;
    return <HistogramViz buckets={buckets} />;
  }
  if (variant === 'date') {
    const buckets = dateHistogram(field, rows);
    if (buckets.length === 0) return <EmptyHint>No dates submitted yet</EmptyHint>;
    return <DateAreaViz buckets={buckets} />;
  }
  if (!isChartableField(field)) return null;

  const buckets = bucketize(field, rows);
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0) return <EmptyHint>No data yet</EmptyHint>;

  if (variant === 'pie') return <PieViz buckets={buckets} />;
  if (variant === 'hbar') return <HBarViz buckets={buckets} />;
  return <HistogramViz buckets={buckets} />;
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground py-2 text-xs italic">{children}</p>;
}

function PieViz({ buckets }: { buckets: AggregateBucket[] }) {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <ChartContainer config={CHART_CONFIG} className="aspect-square size-32 shrink-0">
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={buckets}
            dataKey="count"
            nameKey="label"
            innerRadius="55%"
            outerRadius="90%"
            strokeWidth={1}
          >
            {buckets.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs">
        {buckets.map((b, i) => {
          const pct = total === 0 ? 0 : Math.round((b.count / total) * 100);
          return (
            <li key={b.label} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-1 inline-block size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="min-w-0 flex-1 break-words" title={b.label}>
                {b.label}
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {b.count} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HBarViz({ buckets }: { buckets: AggregateBucket[] }) {
  const data = [...buckets].sort((a, b) => b.count - a.count);
  const total = data.reduce((s, b) => s + b.count, 0);
  return (
    <ul className="flex flex-col gap-2 text-xs">
      {data.map((b, i) => {
        const pct = total === 0 ? 0 : Math.round((b.count / total) * 100);
        return (
          <li key={b.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 flex-1 break-words" title={b.label}>
                {b.label}
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {b.count} · {pct}%
              </span>
            </div>
            <div className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function HistogramViz({ buckets }: { buckets: AggregateBucket[] }) {
  return (
    <ChartContainer config={CHART_CONFIG} className="aspect-[16/7] max-h-40 w-full">
      <BarChart accessibilityLayer data={buckets} margin={{ left: 0, right: 8, top: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} fontSize={11} />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          fontSize={11}
          width={24}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill={PALETTE[0]} radius={4}>
          <LabelList dataKey="count" position="top" fontSize={10} className="fill-foreground" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function DateAreaViz({ buckets }: { buckets: AggregateBucket[] }) {
  return (
    <ChartContainer config={CHART_CONFIG} className="aspect-[16/7] max-h-40 w-full">
      <AreaChart accessibilityLayer data={buckets} margin={{ left: 0, right: 8, top: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} fontSize={11} />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          fontSize={11}
          width={24}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke={PALETTE[0]}
          fill={PALETTE[0]}
          fillOpacity={0.18}
          strokeWidth={1.5}
        />
      </AreaChart>
    </ChartContainer>
  );
}

function TextTopList({ items, total }: { items: AggregateBucket[]; total: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
        Top {items.length} answer{items.length === 1 ? '' : 's'}
      </p>
      <ul className="flex flex-col gap-1.5 text-xs">
        {items.map((it) => {
          const pct = total === 0 ? 0 : Math.round((it.count / total) * 100);
          return (
            <li key={it.label} className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 break-words" title={it.label}>
                {it.label}
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {it.count} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Keyword "cloud" — scales font size with frequency so the eye picks up the
 * dominant terms first. Not a true word cloud (no random rotation) but reads
 * faster than a bar list for high-cardinality long-text responses.
 */
function KeywordCloud({ items }: { items: AggregateBucket[] }) {
  const maxCount = items.reduce((m, it) => Math.max(m, it.count), 1);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
        Top keywords
      </p>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {items.map((it) => {
          const ratio = it.count / maxCount;
          const fontSize = 12 + Math.round(ratio * 12);
          const opacity = 0.55 + ratio * 0.45;
          return (
            <span
              key={it.label}
              className="text-foreground inline-flex items-baseline gap-1 font-medium"
              style={{ fontSize, opacity }}
            >
              {it.label}
              <span className="text-muted-foreground text-[10px] font-normal tabular-nums">
                {it.count}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function FilesSummary({
  field,
  rows,
  summary,
}: {
  field: FormField;
  rows: Record<string, unknown>[];
  summary: { totalFiles: number; totalBytes: number };
}) {
  // Summary tab intentionally hides file content (previews, download links).
  // Show aggregate counts + filename pills only. Full attachments are viewable
  // from the Individual tab's submission detail dialog.
  const attachments = rows
    .map((row) => row[field.id])
    .filter(isFileAttachmentValue)
    .slice(0, 8)
    .map((a) => coerceFileAttachment(a))
    .filter((a): a is NonNullable<typeof a> => !!a);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
        {summary.totalFiles} file{summary.totalFiles === 1 ? '' : 's'}
        {summary.totalBytes > 0 && ` · ${formatBytes(summary.totalBytes)}`}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {attachments.map((att, i) => (
          <span
            key={`${att.url}-${i}`}
            className="bg-muted/40 text-muted-foreground inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]"
            title={att.name}
          >
            <Paperclip className="size-3 shrink-0" />
            <span className="truncate">{att.name}</span>
          </span>
        ))}
      </div>
      <p className="text-muted-foreground/70 text-[10px] italic">
        Open the Individual tab to preview or download files.
      </p>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Legacy export kept for callers that still want to detect "any chartable
 * questions" without rendering. New surface uses AggregateCharts directly.
 */
export function AggregateChartsHeader() {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <BarChart3 className="text-muted-foreground h-4 w-4" />
      Questions
    </div>
  );
}
