'use client';

import { type ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';
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
import { Card, CardContent } from '../../../ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../../ui/chart';
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
}

/**
 * Per-question summary cards. One card per input field that has either a
 * chartable distribution (donut / horizontal bar / histogram) or text
 * frequencies. Layout-only fields are filtered upstream. Returns null when
 * nothing summarizable exists so the parent renders a cleaner layout.
 */
export function AggregateCharts({ fields, decryptedRows }: AggregateChartsProps) {
  const summarizable = fields.filter((f) => isChartableField(f) || isTextField(f));
  if (summarizable.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {summarizable.map((field) => (
        <FieldCard key={field.id} field={field} rows={decryptedRows} />
      ))}
    </div>
  );
}

interface FieldCardProps {
  field: FormField;
  rows: Record<string, unknown>[];
}

function FieldCard({ field, rows }: FieldCardProps) {
  const summary = summarizeField(field, rows);
  const total = rows.length;
  const skipPct = total === 0 ? 0 : Math.round((summary.skipped / total) * 100);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="line-clamp-1 text-sm font-medium">{field.label || field.id}</span>
          <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
            {field.type.replace(/_/g, ' ')}
          </span>
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
    </Card>
  );
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
      <ul className="flex flex-col gap-1 text-xs">
        {buckets.map((b, i) => {
          const pct = total === 0 ? 0 : Math.round((b.count / total) * 100);
          return (
            <li key={b.label} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="line-clamp-1 min-w-0 flex-1">{b.label}</span>
              <span className="text-muted-foreground tabular-nums">
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
    <ul className="flex flex-col gap-1.5">
      {data.map((b, i) => {
        const pct = total === 0 ? 0 : Math.round((b.count / total) * 100);
        return (
          <li key={b.label} className="flex flex-col gap-0.5 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="line-clamp-1 min-w-0 flex-1">{b.label}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {b.count} · {pct}%
              </span>
            </div>
            <div className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: PALETTE[i % PALETTE.length],
                }}
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

function TextTopList({ items, total }: { items: AggregateBucket[]; total: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
        Top {items.length} answer{items.length === 1 ? '' : 's'}
      </p>
      <ul className="flex flex-col gap-1 text-xs">
        {items.map((it) => {
          const pct = total === 0 ? 0 : Math.round((it.count / total) * 100);
          return (
            <li key={it.label} className="flex items-baseline justify-between gap-2">
              <span className="line-clamp-1 min-w-0 flex-1">{it.label}</span>
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
