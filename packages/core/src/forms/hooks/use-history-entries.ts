/* eslint-disable react-hooks/purity */
'use client';

import { useFormBuilderStore } from '../store/form-builder-store';

export interface HistoryEntry {
  /** Index into the underlying past + current + future timeline. */
  originalIdx: number;
  label: string;
  timestamp: number;
  /** True for the active entry (no jump action available). */
  isCurrent: boolean;
  /** Future entries are shown dimmed. */
  isFuture: boolean;
}

export interface UseHistoryEntriesResult {
  /** Entries in display order — newest first. Empty if there's no history yet. */
  entries: HistoryEntry[];
  isEmpty: boolean;
  jumpTo: (originalIdx: number) => void;
}

/**
 * Materializes the change-history timeline shown in the right sidebar.
 *
 * The store keeps `past` (oldest first), `currentLabel` + `schema` for
 * the active state, and `future` (newest first). This hook flattens
 * those into one ordered list, marks each entry as past / current /
 * future, and reverses the result so newest renders at the top.
 */
export function useHistoryEntries(): UseHistoryEntriesResult {
  const past = useFormBuilderStore((s) => s.past);
  const future = useFormBuilderStore((s) => s.future);
  const currentLabel = useFormBuilderStore((s) => s.currentLabel);
  const schema = useFormBuilderStore((s) => s.schema);
  const jumpTo = useFormBuilderStore((s) => s.jumpToHistory);

  const currentIndex = past.length;

  const isEmpty = past.length === 0 && future.length === 0;
  if (isEmpty) {
    return { entries: [], isEmpty: true, jumpTo };
  }

  const combined = [...past, { schema, label: currentLabel, timestamp: Date.now() }, ...future];

  const entries: HistoryEntry[] = combined
    .map((entry, idx) => ({
      originalIdx: idx,
      label: entry.label,
      timestamp: entry.timestamp,
      isCurrent: idx === currentIndex,
      isFuture: idx > currentIndex,
    }))
    .reverse();

  return { entries, isEmpty: false, jumpTo };
}
