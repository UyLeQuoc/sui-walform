/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { useFormBuilderStore } from '../store/form-builder-store';

export type RightSidebarMode = 'auto' | 'history' | 'settings' | 'collaboration';

export interface UseRightSidebarModeResult {
  mode: RightSidebarMode;
  setMode: (mode: RightSidebarMode) => void;
  toggle: (mode: Exclude<RightSidebarMode, 'auto'>) => void;
  resetToAuto: () => void;
}

/**
 * State for the right sidebar's pinned-pane vs. selection-driven view.
 *
 * When the user picks a field (or the submit / cover block) the panel
 * should pop out of any pinned pane (`history` / `settings`) so the
 * properties panel becomes visible.
 */
export function useRightSidebarMode(): UseRightSidebarModeResult {
  const selectedFieldId = useFormBuilderStore((s) => s.selectedFieldId);
  const isSubmitSelected = useFormBuilderStore((s) => s.isSubmitSelected);
  const isCoverSelected = useFormBuilderStore((s) => s.isCoverSelected);

  const [mode, setMode] = useState<RightSidebarMode>('auto');

  useEffect(() => {
    if (selectedFieldId || isSubmitSelected || isCoverSelected) {
      setMode('auto');
    }
  }, [selectedFieldId, isSubmitSelected, isCoverSelected]);

  const toggle = (next: Exclude<RightSidebarMode, 'auto'>) => {
    setMode((current) => (current === next ? 'auto' : next));
  };

  return {
    mode,
    setMode,
    toggle,
    resetToAuto: () => setMode('auto'),
  };
}
