export type TimelineGranularity = 'hour' | 'day' | 'week';

export interface TimelineBucket {
  /** UTC ms at the start of the bucket. */
  startMs: number;
  /** Pre-formatted axis label (locale short). */
  label: string;
  count: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * Pick a granularity based on the span of `timestamps`. Hour up to ~24h,
 * day up to ~30d, week beyond. Returns 'day' for empty input — caller can
 * fall back to "no responses yet".
 */
export function pickGranularity(timestamps: number[], nowMs = Date.now()): TimelineGranularity {
  if (timestamps.length === 0) return 'day';
  const oldest = Math.min(...timestamps);
  const span = nowMs - oldest;
  if (span <= 36 * HOUR_MS) return 'hour';
  if (span <= 45 * DAY_MS) return 'day';
  return 'week';
}

function bucketStart(ms: number, granularity: TimelineGranularity): number {
  const d = new Date(ms);
  if (granularity === 'hour') {
    d.setMinutes(0, 0, 0);
    return d.getTime();
  }
  if (granularity === 'day') {
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  // ISO-ish week: shift to Monday 00:00.
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

function step(granularity: TimelineGranularity): number {
  if (granularity === 'hour') return HOUR_MS;
  if (granularity === 'day') return DAY_MS;
  return WEEK_MS;
}

function formatLabel(ms: number, granularity: TimelineGranularity): string {
  const d = new Date(ms);
  if (granularity === 'hour') {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', hour12: true });
  }
  if (granularity === 'day') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Bucket submission timestamps into a dense series (zero-filled gaps) so the
 * chart shows a continuous timeline rather than jumping between days that
 * happen to have data. Cap output at ~36 buckets for axis readability.
 */
export function bucketizeTimeline(
  timestamps: number[],
  nowMs = Date.now(),
  granularityOverride?: TimelineGranularity,
): { buckets: TimelineBucket[]; granularity: TimelineGranularity } {
  const granularity = granularityOverride ?? pickGranularity(timestamps, nowMs);
  if (timestamps.length === 0) {
    return { buckets: [], granularity };
  }
  const stepMs = step(granularity);
  const earliest = bucketStart(Math.min(...timestamps), granularity);
  const latest = bucketStart(nowMs, granularity);
  const counts = new Map<number, number>();
  for (const ts of timestamps) {
    const key = bucketStart(ts, granularity);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rawCount = Math.floor((latest - earliest) / stepMs) + 1;
  // Trim the leading window if the series is very long — keep the last ~36
  // buckets so axis labels stay legible.
  const maxBuckets = 36;
  const startMs =
    rawCount > maxBuckets ? earliest + (rawCount - maxBuckets) * stepMs : earliest;
  const buckets: TimelineBucket[] = [];
  for (let t = startMs; t <= latest; t += stepMs) {
    buckets.push({
      startMs: t,
      label: formatLabel(t, granularity),
      count: counts.get(t) ?? 0,
    });
  }
  return { buckets, granularity };
}
