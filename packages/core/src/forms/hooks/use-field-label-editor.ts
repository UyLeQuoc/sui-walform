'use client';

import { Extension } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { useEditor, type Editor } from '@tiptap/react';
import { useEffect, useState } from 'react';
import type { FieldType } from '../../types';
import { useFormBuilderStore } from '../store/form-builder-store';

const SingleLine = Extension.create({
  name: 'singleLine',
  addKeyboardShortcuts() {
    return {
      Enter: () => true,
      'Shift-Enter': () => true,
    };
  },
});

interface UseFieldLabelEditorParams {
  fieldId: string;
  initialLabel: string;
  /** Insertion index for slash-command field creation. */
  index: number;
}

export interface UseFieldLabelEditorResult {
  editor: Editor | null;
  showSlash: boolean;
  /** Insert a new field after the current one and reset the slash menu. */
  handleSlashSelect: (type: FieldType) => void;
  /** Close the slash menu and clear the trigger character. */
  closeSlash: () => void;
}

/**
 * The single-line label editor used by the canvas FieldBlock. Watches
 * for a lone `/` character to open the slash command menu — when the
 * user picks a type, a new field is inserted at `index + 1` and the
 * editor's content is cleared so the slash isn't persisted as a label.
 */
export function useFieldLabelEditor({
  fieldId,
  initialLabel,
  index,
}: UseFieldLabelEditorParams): UseFieldLabelEditorResult {
  const updateFieldLabel = useFormBuilderStore((s) => s.updateFieldLabel);
  const addFieldAt = useFormBuilderStore((s) => s.addFieldAt);
  const [showSlash, setShowSlash] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, SingleLine, Placeholder.configure({ placeholder: 'Question' })],
    content: initialLabel,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      if (text === '/') {
        setShowSlash(true);
        return;
      }
      setShowSlash(false);
      updateFieldLabel(fieldId, text);
    },
  });

  // External label edits (right-sidebar FieldSettings input, undo/redo,
  // AI-generated renames) must round-trip back into the TipTap editor so
  // the canvas reflects them without a page reload. `setContent` with the
  // same text would still re-fire onUpdate → infinite loop, so we gate on
  // a strict text inequality first.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getText();
    if (current === initialLabel) return;
    editor.commands.setContent(initialLabel, { emitUpdate: false });
  }, [editor, initialLabel]);

  const handleSlashSelect = (type: FieldType) => {
    editor?.commands.clearContent();
    setShowSlash(false);
    addFieldAt(type, index + 1);
  };

  const closeSlash = () => {
    setShowSlash(false);
    editor?.commands.clearContent();
  };

  return { editor, showSlash, handleSlashSelect, closeSlash };
}
