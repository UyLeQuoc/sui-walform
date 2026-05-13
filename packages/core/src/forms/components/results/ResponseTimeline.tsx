'use client';

import { useState } from 'react';
import { Activity, AreaChart as AreaIcon, BarChart3, LineChart as LineIcon } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
import { ToggleGroup, ToggleGroupItem } from '../../../ui/toggle-group';
import { bucketizeTimeline } from '../../lib/timeline-buckets';

const CHART_CONFIG: ChartConfig = {
  count: { label: 'Responses', color: 'var(--chart-1, hsl(220 70% 50%))' },
};

const GRANULARITY_LABEL: Record<'hour' | 'day' | 'week', string> = {
  hour: 'hourly',
  day: 'daily',
  week: 'weekly',
};

type ChartKind = 'line' | 'bar' | 'area';

interface ResponseTimelineProps {
  /** Submission timestamps in unix-ms. */
  timestamps: number[];
}

export function ResponseTimeline({ timestamps }: ResponseTimelineProps) {
  const [kind, setKind] = useState<ChartKind>('line');
  if (timestamps.length === 0) return null;
  const { buckets, granularity } = bucketizeTimeline(timestamps);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <Activity className="text-muted-foreground h-4 w-4" />
          Responses over time
          <span className="text-muted-foreground text-xs">({GRANULARITY_LABEL[granularity]})</span>
          <ToggleGroup
            type="single"
            value={kind}
            onValueChange={(v) => v && setKind(v as ChartKind)}
            size="sm"
            variant="outline"
            className="ml-auto"
          >
            <ToggleGroupItem value="line" aria-label="Line chart">
              <LineIcon className="h-3.5 w-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="bar" aria-label="Bar chart">
              <BarChart3 className="h-3.5 w-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="area" aria-label="Area chart">
              <AreaIcon className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <ChartContainer config={CHART_CONFIG} className="aspect-[16/4] max-h-48 w-full">
          {renderChart(kind, buckets)}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

type Bucket = { label: string; count: number };

function renderChart(kind: ChartKind, buckets: Bucket[]) {
  const sharedAxes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        tickMargin={6}
        fontSize={11}
        minTickGap={20}
      />
      <YAxis
        allowDecimals={false}
        tickLine={false}
        axisLine={false}
        tickMargin={4}
        fontSize={11}
        width={28}
      />
      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
    </>
  );

  if (kind === 'bar') {
    return (
      <BarChart accessibilityLayer data={buckets} margin={{ left: 0, right: 8, top: 4 }}>
        {sharedAxes}
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
      </BarChart>
    );
  }
  if (kind === 'area') {
    return (
      <AreaChart accessibilityLayer data={buckets} margin={{ left: 0, right: 8, top: 4 }}>
        {sharedAxes}
        <Area
          dataKey="count"
          type="monotone"
          fill="var(--color-count)"
          fillOpacity={0.25}
          stroke="var(--color-count)"
          strokeWidth={2}
        />
      </AreaChart>
    );
  }
  return (
    <LineChart accessibilityLayer data={buckets} margin={{ left: 0, right: 8, top: 4 }}>
      {sharedAxes}
      <Line
        dataKey="count"
        type="monotone"
        stroke="var(--color-count)"
        strokeWidth={2}
        dot={{ r: 3 }}
        activeDot={{ r: 4 }}
      />
    </LineChart>
  );
}
