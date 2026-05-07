'use client';

import { useEffect } from 'react';

interface UseEditorShortcutsParams {
  onUndo: () => void;
  onRedo: () => void;
  onEscape: () => void;
}

/**
 * Wires the editor's window-level keyboard shortcuts:
 *   - Cmd/Ctrl + Z         → undo
 *   - Cmd/Ctrl + Shift + Z → redo
 *   - Cmd/Ctrl + Y         → redo
 *   - Escape               → consumer-defined deselect / close
 *
 * Skips when focus is on a contentEditable host so TipTap's own undo
 * stack inside an inline label doesn't fight the global one.
 */
export function useEditorShortcuts({ onUndo, onRedo, onEscape }: UseEditorShortcutsParams): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).isContentEditable) return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        onUndo();
        return;
      }

      if ((mod && e.shiftKey && e.key === 'z') || (mod && e.key === 'y')) {
        e.preventDefault();
        onRedo();
        return;
      }

      if (e.key === 'Escape') {
        onEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo, onRedo, onEscape]);
}
