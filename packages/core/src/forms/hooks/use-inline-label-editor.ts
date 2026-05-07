'use client';

import { Extension } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { useEditor, type Editor } from '@tiptap/react';
import { useEffect } from 'react';

/**
 * TipTap extension that disables Enter / Shift-Enter so multi-line
 * input is impossible inside an inline label editor.
 */
const SingleLine = Extension.create({
  name: 'singleLine',
  addKeyboardShortcuts() {
    return {
      Enter: () => true,
      'Shift-Enter': () => true,
    };
  },
});

interface UseInlineLabelEditorParams {
  /** Current label text from the store. */
  value: string;
  /** Empty-state placeholder. */
  placeholder: string;
  /** Called on every edit with the editor's current plain text. */
  onUpdate: (text: string) => void;
}

/**
 * A single-line inline TipTap editor wired to a string value owned by
 * the store. Re-syncs the editor's content if `value` changes from
 * outside (e.g. undo / redo) and the editor's text drifts from it.
 */
export function useInlineLabelEditor({
  value,
  placeholder,
  onUpdate,
}: UseInlineLabelEditorParams): Editor | null {
  const editor = useEditor({
    extensions: [StarterKit, SingleLine, Placeholder.configure({ placeholder })],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onUpdate(editor.getText()),
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getText() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  return editor;
}
