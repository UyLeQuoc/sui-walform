import { cpp } from '@codemirror/lang-cpp';
import { css } from '@codemirror/lang-css';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import type { Extension } from '@codemirror/state';

/**
 * Registry of languages the `code` field supports. Each entry lazily returns
 * the CodeMirror language extension — stays tree-shakeable per-language.
 */
export interface CodeLanguage {
  /** Stable key persisted in the form schema. */
  key: string;
  /** User-facing label in the settings select. */
  label: string;
  /** CodeMirror language extension factory. `null` disables highlighting. */
  extension: () => Extension | null;
  /** If true, the user-facing select shows this as a special "auto" entry. */
  auto?: boolean;
}

export const AUTO_DETECT_KEY = 'auto';

export const CODE_LANGUAGES: CodeLanguage[] = [
  {
    key: AUTO_DETECT_KEY,
    label: 'Auto-detect',
    extension: () => null,
    auto: true,
  },
  { key: 'plaintext', label: 'Plain Text', extension: () => null },
  {
    key: 'javascript',
    label: 'JavaScript',
    extension: () => javascript(),
  },
  {
    key: 'typescript',
    label: 'TypeScript',
    extension: () => javascript({ typescript: true }),
  },
  {
    key: 'jsx',
    label: 'JSX',
    extension: () => javascript({ jsx: true }),
  },
  {
    key: 'tsx',
    label: 'TSX',
    extension: () => javascript({ jsx: true, typescript: true }),
  },
  { key: 'python', label: 'Python', extension: () => python() },
  { key: 'html', label: 'HTML', extension: () => html() },
  { key: 'css', label: 'CSS', extension: () => css() },
  { key: 'json', label: 'JSON', extension: () => json() },
  { key: 'sql', label: 'SQL', extension: () => sql() },
  { key: 'markdown', label: 'Markdown', extension: () => markdown() },
  { key: 'xml', label: 'XML', extension: () => xml() },
  { key: 'cpp', label: 'C / C++', extension: () => cpp() },
  { key: 'java', label: 'Java', extension: () => java() },
  { key: 'php', label: 'PHP', extension: () => php() },
  { key: 'rust', label: 'Rust', extension: () => rust() },
  { key: 'go', label: 'Go', extension: () => go() },
];

export const DEFAULT_CODE_LANGUAGE = 'javascript';

export function getCodeLanguage(key: string | undefined): CodeLanguage {
  return (
    CODE_LANGUAGES.find((l) => l.key === key) ??
    CODE_LANGUAGES.find((l) => l.key === DEFAULT_CODE_LANGUAGE)!
  );
}

/**
 * Heuristic language detector for the curated set of languages we support.
 * Uses simple signature-based rules scored by weight — returns the best
 * match, or `"plaintext"` if nothing scores.
 *
 * Keep rules ordered from most-specific to most-generic to prefer strong
 * signals (e.g. `<?php`, `#include`) over generic ones (`function`).
 */
export function detectCodeLanguage(source: string): string {
  const text = source.trim();
  if (!text) return 'plaintext';

  const scores: Record<string, number> = {};
  const bump = (key: string, amount: number) => {
    scores[key] = (scores[key] ?? 0) + amount;
  };

  // ── strong single-signal markers ──
  if (/<\?php\b/.test(text)) return 'php';
  if (/^#!.*\bpython/m.test(text)) return 'python';
  if (/^#!.*\bnode/m.test(text)) return 'javascript';
  if (/^\s*<(!doctype html|html\b|body\b|div\b)/i.test(text)) return 'html';
  if (/^\s*<\?xml\b/.test(text)) return 'xml';

  // JSON: looks like a JSON document front-to-back.
  if (/^\s*[{[]/.test(text) && /[}\]]\s*$/.test(text)) {
    try {
      JSON.parse(text);
      return 'json';
    } catch {
      /* fall through */
    }
  }

  // ── weighted heuristics ──
  // TypeScript / JavaScript
  if (/\b(interface|type)\s+\w+\s*=/.test(text)) bump('typescript', 6);
  if (/:\s*(string|number|boolean|any|unknown|void)\b/.test(text)) bump('typescript', 4);
  if (/\bas\s+(const|string|number)\b/.test(text)) bump('typescript', 3);
  if (/\bimport\s+.+\s+from\s+['"]/.test(text)) bump('javascript', 3);
  if (/\bexport\s+(default|const|function|class)\b/.test(text)) bump('javascript', 3);
  if (/\bconst\s+\w+\s*=/.test(text)) bump('javascript', 2);
  if (/=>\s*[{(]/.test(text)) bump('javascript', 2);
  if (/\bconsole\.log\(/.test(text)) bump('javascript', 2);
  if (/<\/?[A-Z]\w*/.test(text)) bump('jsx', 4);
  if (/<\/?[A-Z]\w*/.test(text) && scores.typescript) bump('tsx', 5);

  // Python
  if (/^\s*def\s+\w+\s*\(.*\)\s*:/m.test(text)) bump('python', 5);
  if (/^\s*class\s+\w+\s*(\(.*\))?\s*:/m.test(text)) bump('python', 4);
  if (/^\s*from\s+\w[\w.]*\s+import\b/m.test(text)) bump('python', 5);
  if (/\bprint\s*\(/.test(text) && /:\s*$/m.test(text)) bump('python', 3);
  if (/\bself\b/.test(text)) bump('python', 2);

  // Go
  if (/^\s*package\s+\w+/m.test(text)) bump('go', 5);
  if (/\bfunc\s+\w+\s*\(/.test(text)) bump('go', 4);
  if (/:=/.test(text)) bump('go', 2);

  // Rust
  if (/\bfn\s+\w+\s*\(/.test(text)) bump('rust', 5);
  if (/\blet\s+mut\s+/.test(text)) bump('rust', 5);
  if (/->\s*\w+\s*[{;]/.test(text)) bump('rust', 2);
  if (/\bimpl\s+\w+/.test(text)) bump('rust', 4);

  // Java
  if (/\bpublic\s+(class|interface|enum)\s+\w+/.test(text)) bump('java', 5);
  if (/\bSystem\.out\.println\b/.test(text)) bump('java', 5);

  // C / C++
  if (/^\s*#include\s*<.+>/m.test(text)) bump('cpp', 5);
  if (/\bstd::/.test(text)) bump('cpp', 4);
  if (/\bint\s+main\s*\(/.test(text)) bump('cpp', 3);

  // SQL
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(text)) bump('sql', 5);
  if (/\bFROM\s+\w+/i.test(text)) bump('sql', 3);

  // CSS
  if (/^[\w\-.#:[\]*,\s]+\{[^}]*\}/m.test(text)) bump('css', 4);
  if (/:\s*[\w-]+\s*;/.test(text)) bump('css', 2);

  // Markdown
  if (/^#{1,6}\s+\S/m.test(text)) bump('markdown', 3);
  if (/^\s*[-*]\s+\S/m.test(text)) bump('markdown', 1);
  if (/\[.+\]\(.+\)/.test(text)) bump('markdown', 2);
  if (/^```/m.test(text)) bump('markdown', 4);

  // Pick the highest scorer (minimum threshold to avoid false positives).
  let bestKey = 'plaintext';
  let bestScore = 2;
  for (const [key, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  return bestKey;
}
