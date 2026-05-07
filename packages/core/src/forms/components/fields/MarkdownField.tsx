'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { FormField } from '../../../types';

const SAFE_URL_RE = /^(?:https?:|mailto:|tel:|#|\/)/i;

/**
 * Whitelist link protocols rendered from markdown. Without this, a creator
 * (or a cloned-template author) can author `[click](javascript:alert(1))`
 * and exfil data on viewer click. ReactMarkdown's HTML sanitizer doesn't
 * inspect link href values.
 */
function sanitizeHref(href: string | undefined): string {
  if (!href) return '#';
  return SAFE_URL_RE.test(href) ? href : '#';
}

interface MarkdownFieldProps {
  field: FormField;
}

function buildTextDecoration(field: FormField): string | undefined {
  const parts: string[] = [];
  if (field.fontUnderline) parts.push('underline');
  if (field.fontStrikethrough) parts.push('line-through');
  return parts.length > 0 ? parts.join(' ') : undefined;
}

export function MarkdownField({ field }: MarkdownFieldProps) {
  if (!field.label) return null;

  return (
    <div
      className="text-foreground px-3 py-2"
      style={{
        fontWeight: field.fontBold ? 'bold' : undefined,
        fontStyle: field.fontItalic ? 'italic' : undefined,
        textDecoration: buildTextDecoration(field),
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-4 mb-2 text-2xl font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-3 mb-1.5 text-xl font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-2 mb-1 text-lg font-semibold">{children}</h3>,
          p: ({ children }) => <p className="mb-2 text-sm leading-relaxed last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={sanitizeHref(href)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="mb-2 list-disc pl-5 text-sm">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 text-sm">{children}</ol>,
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-muted-foreground/30 my-2 border-l-4 pl-3 text-sm italic opacity-80">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            return isBlock ? (
              <code className="bg-muted text-foreground block overflow-x-auto rounded-md p-3 font-mono text-xs">
                {children}
              </code>
            ) : (
              <code className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-xs">
                {children}
              </code>
            );
          },
          hr: () => <hr className="border-border my-3" />,
        }}
      >
        {field.label}
      </ReactMarkdown>
    </div>
  );
}
