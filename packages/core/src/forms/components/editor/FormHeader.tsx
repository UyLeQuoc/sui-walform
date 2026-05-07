'use client';

import { Extension } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';
import { useFormBuilderStore } from '../../store/form-builder-store';

const NoNewLine = Extension.create({
  name: 'noNewLine',
  addKeyboardShortcuts() {
    return {
      Enter: () => true,
      'Shift-Enter': () => true,
    };
  },
});

export function FormHeader() {
  const { schema, updateTitle, updateDescription } = useFormBuilderStore();

  const titleEditor = useEditor({
    extensions: [StarterKit, NoNewLine, Placeholder.configure({ placeholder: 'Untitled Form' })],
    content: schema.title,
    immediatelyRender: false,
    onUpdate: ({ editor }) => updateTitle(editor.getText()),
  });

  const descEditor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Add a description (optional)…' }),
    ],
    content: schema.description ?? '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => updateDescription(editor.getText()),
  });

  return (
    <div className="mb-10 px-3">
      <EditorContent
        editor={titleEditor}
        className="[&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap]:text-3xl [&_.tiptap]:leading-tight [&_.tiptap]:font-bold [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap.ProseMirror-focused]:outline-none"
      />
      <EditorContent
        editor={descEditor}
        className="[&_.tiptap]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground/60 mt-2 [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap.ProseMirror-focused]:outline-none"
      />
    </div>
  );
}
