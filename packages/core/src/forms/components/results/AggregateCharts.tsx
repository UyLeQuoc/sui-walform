'use client';

import { BarChart3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '../../../ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../../ui/chart';
import { bucketize, isChartableField, type AggregateBucket } from '../../lib/aggregate-submissions';
import type { FormField } from '../../../types';

const CHART_CONFIG: ChartConfig = {
  count: { label: 'Responses', color: 'var(--chart-1, hsl(220 70% 50%))' },
};

interface AggregateChartsProps {
  fields: FormField[];
  decryptedRows: Record<string, unknown>[];
}

/**
 * Bar charts for chartable fields (single/multi choice, select, yes/no,
 * rating, linear scale). Renders nothing when no fields are chartable so the
 * caller can unconditionally render this above the row list.
 */
export function AggregateCharts({ fields, decryptedRows }: AggregateChartsProps) {
  const chartFields = fields.filter(isChartableField);
  if (chartFields.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="text-muted-foreground h-4 w-4" />
          Aggregates
          <span className="text-muted-foreground text-xs">
            (over {decryptedRows.length} decrypted{' '}
            {decryptedRows.length === 1 ? 'response' : 'responses'})
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {chartFields.map((field) => (
            <FieldAggregate
              key={field.id}
              field={field}
              buckets={bucketize(field, decryptedRows)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface FieldAggregateProps {
  field: FormField;
  buckets: AggregateBucket[];
}

function FieldAggregate({ field, buckets }: FieldAggregateProps) {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">{field.label || field.id}</span>
        <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
          {field.type.replace(/_/g, ' ')}
        </span>
      </div>
      {total === 0 ? (
        <p className="text-muted-foreground text-xs italic">No data yet</p>
      ) : (
        <ChartContainer config={CHART_CONFIG} className="aspect-[16/7] max-h-44 w-full">
          <BarChart accessibilityLayer data={buckets} margin={{ left: 0, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} fontSize={11} />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              fontSize={11}
              width={28}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}
