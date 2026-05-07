'use client';

import { ChevronDown } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { cn } from '../lib/utils';
import { ScrollArea } from './scroll-area';

interface ScrollHintAreaProps {
  children: ReactNode;
  /** Sizing classes for the outer container — typically the same value you'd pass to ScrollArea (e.g. `min-h-0 flex-1`). */
  className?: string;
  /** Override the hint overlay's classes (e.g. taller fade, different gradient stop). */
  hintClassName?: string;
}

/**
 * ScrollArea with a "more below" affordance: a primary-color chevron over a
 * gradient mask appears at the bottom of the scroll area whenever the content
 * overflows AND the user has not yet scrolled to the end.
 *
 * Implementation note: the visibility flag is driven by IntersectionObserver
 * on a 1px sentinel rendered after the children. Compared to a scroll
 * listener, this auto-handles content-size changes (an accordion expands and
 * the bottom moves out of view) without manual ResizeObserver wiring.
 */
export function ScrollHintArea({ children, className, hintClassName }: ScrollHintAreaProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const root = viewportRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Sentinel intersecting = bottom is in view = no more content below.
        if (entry) setShowHint(!entry.isIntersecting);
      },
      { root, threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn('relative', className)}>
      <ScrollArea className="h-full" viewportRef={viewportRef}>
        {children}
        <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      </ScrollArea>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-10 items-end justify-center pb-1 transition-opacity duration-200',
          'from-background/95 bg-gradient-to-t to-transparent',
          showHint ? 'opacity-100' : 'opacity-0',
          hintClassName,
        )}
      >
        <ChevronDown className="text-primary size-4 animate-bounce" />
      </div>
    </div>
  );
}
