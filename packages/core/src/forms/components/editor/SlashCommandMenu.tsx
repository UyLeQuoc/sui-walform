'use client';

/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */

import type { FieldType } from '../../../types';
import { FieldPaletteContent } from './FieldPaletteContent';

interface SlashCommandMenuProps {
  onSelect: (type: FieldType) => void;
  onClose: () => void;
}

/**
 * Floating field-type picker that opens when the user types `/` as the
 * sole content of a field's label editor.
 */
export function SlashCommandMenu({ onSelect, onClose }: SlashCommandMenuProps) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="bg-popover absolute top-full left-0 z-20 mt-1 w-64 overflow-hidden rounded-md border p-0 shadow-md">
        <FieldPaletteContent onSelect={onSelect} />
      </div>
    </>
  );
}
