'use client';

import type { ReactNode } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { formatCell } from '../../lib/format-submission-cell';
import type { FormField } from '../../../types';
import { FileAttachmentView } from './FileAttachmentView';

interface QuestionCardProps {
  index: number;
  field: FormField;
  value: unknown;
}

/**
 * Google Forms-style answer card. Numbered indicator, label + type, then a
 * subtly inset answer box (dashed when unanswered). Used by both the Results
 * Individual-tab dialog and the submitter Receipt page so the two views stay
 * visually identical.
 */
export function QuestionCard({ index, field, value }: QuestionCardProps) {
  const empty = isEmpty(value);
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex min-w-0 flex-col gap-2 p-4">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums">
            {index}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h4 className="text-sm font-semibold [overflow-wrap:anywhere]">
              {field.label || field.id}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </h4>
            <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
              {field.type.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        <div
          className={
            empty
              ? 'border-muted-foreground/20 bg-muted/20 ml-9 rounded-md border border-dashed px-3 py-2'
              : 'bg-muted/30 ml-9 rounded-md border px-3 py-2'
          }
        >
          {empty ? (
            <span className="text-muted-foreground/70 text-xs italic">— not answered —</span>
          ) : field.type === 'file' ? (
            // File attachments own their layout (truncated filename + max-w-full
            // preview) — must NOT sit inside an overflow-x-auto box, which would
            // remove the width constraint the filename truncate relies on.
            <FileAttachmentView value={value} />
          ) : (
            <div className="overflow-x-auto text-sm whitespace-pre-wrap">
              {renderAnswer(field, value)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function renderAnswer(field: FormField, value: unknown): ReactNode {
  if (field.type === 'file') {
    if (!value) return <span className="text-muted-foreground/60">— not answered —</span>;
    return <FileAttachmentView value={value} />;
  }
  const formatted = formatCell(value);
  if (!formatted) return <span className="text-muted-foreground/60">— not answered —</span>;
  return formatted;
}
