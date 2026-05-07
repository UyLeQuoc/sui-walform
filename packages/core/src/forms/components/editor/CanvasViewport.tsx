'use client';

import { type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { ScrollArea } from '../../../ui/scroll-area';
import { useFormBuilderStore } from '../../store/form-builder-store';

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

  const handleEmptyClick = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || suppressDeselect) return;
    // Only deselect when the click landed on the wrapper itself — clicks on
    // the form card (or anything inside it) have a different e.target.
    if (e.target === e.currentTarget) {
      clearSelection();
    }
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
        onPointerDown={handleEmptyClick}
        className="flex min-h-full w-full items-start justify-center px-6 py-12"
      >
        {children}
      </div>
    </ScrollArea>
  );
}
