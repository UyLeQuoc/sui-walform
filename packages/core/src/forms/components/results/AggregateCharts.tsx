'use client';

import { useState, type ReactNode } from 'react';
import { BarChart3, Maximize2 } from 'lucide-react';
import {
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
import { shortAddr } from '../../lib/format-address';
import { formatCell } from '../../lib/format-submission-cell';
import { isFileAttachmentValue } from '../../lib/file-attachment';
import type { SubmissionRow } from '../../hooks/use-form-submissions';
import { FileAttachmentView } from './FileAttachmentView';
import {
  bucketize,
  chartVariantFor,
  isChartableField,
  isTextField,
  summarizeField,
  topTextAnswers,
  type AggregateBucket,
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
  const summarizable = fields.filter((f) => isChartableField(f) || isTextField(f));
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
                {summary.average.toFixed(2)}
              </span>
            </span>
          )}
        </div>
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
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
                  <TableCell className="w-32 align-top whitespace-nowrap text-xs">
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
                  <TableCell className="w-32 align-top whitespace-nowrap text-xs">
                    <code className="font-mono">{shortAddr(e.submitter)}</code>
                  </TableCell>
                  <TableCell className="text-muted-foreground/60 align-top text-xs italic">
                    — skipped —
                  </TableCell>
                </TableRow>
              ))}
              {encrypted.map((e) => (
                <TableRow key={e.submissionId}>
                  <TableCell className="w-32 align-top whitespace-nowrap text-xs">
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
    return <FileAttachmentView value={value} />;
  }
  return formatCell(value);
}

interface FieldVizProps {
  field: FormField;
  rows: Record<string, unknown>[];
  answered: number;
}

function FieldViz({ field, rows, answered }: FieldVizProps) {
  if (isTextField(field)) {
    const top = topTextAnswers(field, rows);
    if (top.length === 0) return <EmptyHint>No text responses yet</EmptyHint>;
    return <TextTopList items={top} total={answered} />;
  }
  if (!isChartableField(field)) return null;
  const buckets = bucketize(field, rows);
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0) return <EmptyHint>No data yet</EmptyHint>;

  const variant = chartVariantFor(field);
  if (variant === 'donut') return <DonutViz buckets={buckets} />;
  if (variant === 'hbar') return <HBarViz buckets={buckets} />;
  return <HistogramViz buckets={buckets} />;
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground py-2 text-xs italic">{children}</p>;
}

function DonutViz({ buckets }: { buckets: AggregateBucket[] }) {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3">
      <ChartContainer config={CHART_CONFIG} className="aspect-square h-32 w-32">
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
      <Table className="text-xs">
        <TableBody>
          {buckets.map((b, i) => {
            const pct = total === 0 ? 0 : Math.round((b.count / total) * 100);
            return (
              <TableRow key={b.label}>
                <TableCell className="w-4 py-1.5 pr-0 pl-0">
                  <span
                    aria-hidden
                    className="inline-block size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                </TableCell>
                <TableCell className="line-clamp-1 max-w-0 py-1.5 pl-2 whitespace-normal">
                  {b.label}
                </TableCell>
                <TableCell className="text-muted-foreground py-1.5 pr-0 text-right tabular-nums">
                  {b.count} · {pct}%
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function HBarViz({ buckets }: { buckets: AggregateBucket[] }) {
  const data = [...buckets].sort((a, b) => b.count - a.count);
  const total = data.reduce((s, b) => s + b.count, 0);
  return (
    <Table className="text-xs">
      <TableBody>
        {data.map((b, i) => {
          const pct = total === 0 ? 0 : Math.round((b.count / total) * 100);
          return (
            <TableRow key={b.label}>
              <TableCell className="max-w-0 py-1.5 pl-0 whitespace-normal">
                <div className="flex flex-col gap-1">
                  <span className="line-clamp-1">{b.label}</span>
                  <div className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground w-20 py-1.5 pr-0 text-right tabular-nums">
                {b.count} · {pct}%
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
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

function TextTopList({ items, total }: { items: AggregateBucket[]; total: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
        Top {items.length} answer{items.length === 1 ? '' : 's'}
      </p>
      <Table className="text-xs">
        <TableBody>
          {items.map((it) => {
            const pct = total === 0 ? 0 : Math.round((it.count / total) * 100);
            return (
              <TableRow key={it.label}>
                <TableCell className="max-w-0 py-1.5 pl-0 whitespace-normal">
                  <span className="line-clamp-1">{it.label}</span>
                </TableCell>
                <TableCell className="text-muted-foreground w-20 py-1.5 pr-0 text-right tabular-nums">
                  {it.count} · {pct}%
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
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
