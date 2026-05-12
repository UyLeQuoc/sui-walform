'use client';

import { Activity } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '../../../ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../../ui/chart';
import { bucketizeTimeline } from '../../lib/timeline-buckets';

const CHART_CONFIG: ChartConfig = {
  count: { label: 'Responses', color: 'var(--chart-1, hsl(220 70% 50%))' },
};

const GRANULARITY_LABEL: Record<'hour' | 'day' | 'week', string> = {
  hour: 'hourly',
  day: 'daily',
  week: 'weekly',
};

interface ResponseTimelineProps {
  /** Submission timestamps in unix-ms. */
  timestamps: number[];
}

/**
 * Responses-over-time bar chart. Works without decryption — pulls straight
 * from the SubmissionCreated event stream's `submittedAtMs`. Auto-picks
 * hour/day/week granularity from the data span.
 */
export function ResponseTimeline({ timestamps }: ResponseTimelineProps) {
  if (timestamps.length === 0) return null;
  const { buckets, granularity } = bucketizeTimeline(timestamps);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity className="text-muted-foreground h-4 w-4" />
          Responses over time
          <span className="text-muted-foreground text-xs">({GRANULARITY_LABEL[granularity]})</span>
        </div>
        <ChartContainer config={CHART_CONFIG} className="aspect-[16/4] max-h-48 w-full">
          <BarChart accessibilityLayer data={buckets} margin={{ left: 0, right: 8, top: 4 }}>
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
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
