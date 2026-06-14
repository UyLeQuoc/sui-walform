'use client';

import { Trophy } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Highlights WalForm's 1st-place finish in Walrus Session 2 (Form Tooling) — a
 * true, completed award, distinct from the current Sui Overflow 2026
 * submission. Gold/amber accent so it stands apart from the primary-colored
 * pills in the hero. Pass `compact` for the tighter hero/footer variant.
 */
export function AwardBadge({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        // Metallic gold (#d4af37) — no gold in the Tailwind palette, so use
        // arbitrary hex. Deeper gold text in light mode for contrast, lighter
        // gold in dark mode.
        'inline-flex items-center gap-1.5 border border-[#caa53d]/50 bg-[#d4af37]/10 px-3 py-1.5 font-semibold text-[#8a6a14] backdrop-blur dark:text-[#ecca6a]',
        compact ? 'text-[11px]' : 'text-xs',
        className,
      )}
    >
      <Trophy className="size-3.5" aria-hidden />
      1st Place · Walrus Session 2
    </span>
  );
}
