'use client';

import { format } from 'date-fns';
import { Clock, CornerDownLeft } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ScrollHintArea } from '../../../ui/scroll-hint-area';
import { useHistoryEntries } from '../../hooks/use-history-entries';

export function HistoryPanel() {
  const { entries, isEmpty, jumpTo } = useHistoryEntries();

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <Clock className="text-muted-foreground/40 size-8" />
        <p className="text-muted-foreground text-sm">
          No history yet. Make changes to see them here.
        </p>
      </div>
    );
  }

  return (
    <ScrollHintArea className="h-full w-full">
      <div className="flex flex-col py-4">
        {entries.map(({ label, timestamp, originalIdx, isCurrent, isFuture }) => (
          <button
            key={originalIdx}
            type="button"
            disabled={isCurrent}
            onClick={() => jumpTo(originalIdx)}
            className={cn(
              'group flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors',
              isCurrent ? 'bg-accent cursor-default' : 'hover:bg-accent/60 cursor-pointer',
              isFuture && 'opacity-50',
            )}
          >
            <div className="mt-1 flex flex-col items-center">
              <div
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  isCurrent
                    ? 'bg-primary'
                    : isFuture
                      ? 'bg-muted-foreground/30'
                      : 'bg-muted-foreground/50',
                )}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className={cn('truncate', isCurrent ? 'font-medium' : 'text-muted-foreground')}>
                {label}
                {isCurrent && (
                  <span className="text-primary ml-1.5 text-xs font-normal">current</span>
                )}
              </p>
              {timestamp > 0 && (
                <p className="text-muted-foreground/60 mt-0.5 text-xs">
                  {format(timestamp, 'HH:mm:ss')}
                </p>
              )}
            </div>

            {!isCurrent && (
              <CornerDownLeft className="text-muted-foreground/0 group-hover:text-muted-foreground mt-0.5 size-3.5 shrink-0 transition-colors" />
            )}
          </button>
        ))}
      </div>
    </ScrollHintArea>
  );
}
