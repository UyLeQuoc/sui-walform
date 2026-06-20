'use client';

import { type CSSProperties, type PointerEvent, type ReactNode, useRef } from 'react';
import { ScrollArea } from '../../../ui/scroll-area';
import { usePresence } from '../../hooks/use-presence';
import { useFormBuilderStore } from '../../store/form-builder-store';
import { useCollab } from './CollabProvider';
import { CursorsOverlay } from './CursorsOverlay';

const CURSOR_THROTTLE_MS = 50;

interface CanvasViewportProps {
  children: ReactNode;
  /**
   * When true, suppresses the deselect-on-empty-click (useful while an item
   * is being dragged so a drop in empty space doesn't clear selection).
   */
  suppressDeselect?: boolean;
}

/**
 * Scrollable dot-grid surface. The canvas no longer pans — users just scroll
 * the form vertically. Clicking the empty dotted area (not the form card)
 * deselects the currently-active field.
 */
export function CanvasViewport({ children, suppressDeselect }: CanvasViewportProps) {
  const clearSelection = useFormBuilderStore((s) => s.clearSelection);
  const displayMode = useFormBuilderStore((s) => s.schema.settings.displayMode ?? 'card');
  const isPageMode = displayMode === 'page';
  const { awareness, setCursor } = useCollab();
  const peers = usePresence(awareness);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const lastMoveRef = useRef(0);

  const handleEmptyClick = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || suppressDeselect) return;
    // Only deselect when the click landed on the wrapper itself — clicks on
    // the form card (or anything inside it) have a different e.target.
    if (e.target === e.currentTarget) {
      clearSelection();
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!awareness) return;
    const now = Date.now();
    if (now - lastMoveRef.current < CURSOR_THROTTLE_MS) return;
    lastMoveRef.current = now;
    const card = wrapperRef.current?.querySelector('[data-form-card]') as HTMLElement | null;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // Broadcast as a fraction of the card so cursors line up across viewers
    // whose cards differ in size (responsive widths). CursorsOverlay scales
    // back up by the local card's dimensions.
    setCursor({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  };

  const handlePointerLeave = () => {
    if (awareness) setCursor(null);
  };

  // Pattern tint is driven by a CSS var so it can flip with the theme —
  // black-ish on light, white-ish on dark. Using rgb() inline keeps it a
  // single `background-image` definition.
  const patternStyle: CSSProperties = isPageMode
    ? {
        backgroundImage:
          'repeating-linear-gradient(-45deg, var(--canvas-pattern) 0 1px, transparent 1px 12px)',
      }
    : {
        backgroundImage: 'radial-gradient(circle, var(--canvas-pattern) 1px, transparent 1.3px)',
        backgroundSize: '20px 20px',
      };

  return (
    <ScrollArea
      className="bg-muted/40 dark:bg-muted/10 flex-1 [--canvas-pattern:rgba(0,0,0,0.14)] dark:[--canvas-pattern:rgba(255,255,255,0.12)]"
      style={patternStyle}
      data-canvas-viewport
    >
      <div
        ref={wrapperRef}
        onPointerDown={handleEmptyClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="relative flex min-h-full w-full items-start justify-center px-6 py-12"
      >
        {children}
        {awareness && <CursorsOverlay peers={peers} containerRef={wrapperRef} />}
      </div>
    </ScrollArea>
  );
}
