/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { EditorView, keymap } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import CodeMirror, { type BasicSetupOptions } from '@uiw/react-codemirror';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { AUTO_DETECT_KEY, detectCodeLanguage, getCodeLanguage } from '../lib/code-languages';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  /**
   * Language key from `CODE_LANGUAGES`. Pass `"auto"` to auto-detect from
   * content — the detected language will also be reported via
   * `onDetectLanguage` so callers can show it in UI.
   */
  language?: string;
  onDetectLanguage?: (detectedKey: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
  ariaInvalid?: boolean;
  ariaLabelledBy?: string;
  id?: string;
}

const BASIC_SETUP: BasicSetupOptions = {
  lineNumbers: true,
  foldGutter: true,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
  // Completion + brackets: turned on here AND added explicitly to extensions
  // below so suggestions stay available even for users running a stripped
  // basic setup.
  autocompletion: true,
  bracketMatching: true,
  closeBrackets: true,
  indentOnInput: true,
  searchKeymap: false,
};

/**
 * CodeMirror 6-based code editor. SSR-safe, always rendered with the
 * one-dark theme, and supports per-language syntax highlighting plus
 * auto-detection from content.
 *
 * Code suggestions (autocomplete) are enabled — each `@codemirror/lang-*`
 * extension contributes its own completion source (keywords, built-ins,
 * scope-aware identifiers). Trigger with `Ctrl-Space` or keep typing.
 */
export function CodeEditor({
  value,
  onChange,
  onBlur,
  language,
  onDetectLanguage,
  placeholder,
  readOnly,
  minHeight = '8rem',
  maxHeight = '24rem',
  className,
  ariaInvalid,
  ariaLabelledBy,
  id,
}: CodeEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Resolve the language to use: either an explicit key or the auto-detected
  // key derived from the current content.
  const resolvedKey = useMemo(() => {
    if (language !== AUTO_DETECT_KEY) return language;
    return detectCodeLanguage(value);
  }, [language, value]);

  // Report the auto-detected language upward so the preview badge can show
  // e.g. "Auto · TypeScript". Runs only in auto mode.
  useEffect(() => {
    if (language === AUTO_DETECT_KEY && onDetectLanguage && resolvedKey) {
      onDetectLanguage(resolvedKey);
    }
  }, [language, resolvedKey, onDetectLanguage]);

  const extensions = useMemo(() => {
    const langExt = getCodeLanguage(resolvedKey).extension();
    const base = [
      EditorView.lineWrapping,
      // Redundant with basicSetup but guarantees completion/bracket keymaps
      // regardless of CodeMirror build flags.
      autocompletion({ activateOnTyping: true }),
      closeBrackets(),
      keymap.of([...completionKeymap, ...closeBracketsKeymap]),
    ];
    return langExt ? [...base, langExt] : base;
  }, [resolvedKey]);

  if (!mounted) {
    // Server-render + pre-hydration: a dark monospace placeholder that matches
    // the mounted editor's surface so layout doesn't jump.
    return (
      <div
        id={id}
        className={cn(
          'rounded-md border border-[#3e4451] bg-[#282c34] px-3 py-2 font-mono text-sm text-[#abb2bf]',
          className,
        )}
        style={{ minHeight }}
      >
        {value || placeholder || ''}
      </div>
    );
  }

  return (
    <div
      id={id}
      aria-invalid={ariaInvalid || undefined}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        'focus-within:ring-ring/50 overflow-hidden rounded-md border border-[#3e4451] text-sm shadow-xs transition focus-within:ring-[3px]',
        'aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        // Always dark — the code field intentionally ignores the app theme so
        // users get a consistent, high-contrast editing surface.
        theme={oneDark}
        extensions={extensions}
        basicSetup={BASIC_SETUP}
        placeholder={placeholder}
        readOnly={readOnly}
        editable={!readOnly}
        minHeight={minHeight}
        maxHeight={maxHeight}
      />
    </div>
  );
}
