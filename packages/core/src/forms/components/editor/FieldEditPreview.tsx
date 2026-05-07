'use client';

import { memo, useMemo } from 'react';
import { CalendarIcon, Star, Upload } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Checkbox } from '../../../ui/checkbox';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { RadioGroup, RadioGroupItem } from '../../../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Textarea } from '../../../ui/textarea';
import { CodeEditor } from '../CodeEditor';
import { AUTO_DETECT_KEY, getCodeLanguage } from '../../lib/code-languages';
import { TEXT_ALIGN_CLASSES } from '../../lib/inline-text-style';
import { cn } from '../../../lib/utils';
import type { FormField } from '../../../types';

interface FieldEditPreviewProps {
  field: FormField;
}

/**
 * Heading sizing in the disabled canvas preview is one tier smaller than
 * the live form (h1=2xl, h2=xl, h3=lg) so the canvas still reads as a
 * builder surface and not as a published form.
 */
const HEADING_CLASSES = {
  h1: 'text-2xl font-bold',
  h2: 'text-xl font-semibold',
  h3: 'text-lg font-medium',
} as const;

const NO_OPTIONS_HINT = (
  <p className="text-muted-foreground mt-2 text-xs italic">
    No options yet — add them in the settings panel
  </p>
);

function FieldEditPreviewImpl({ field }: FieldEditPreviewProps) {
  const placeholder = field.placeholder;

  switch (field.type) {
    case 'short_text':
      return (
        <Input
          disabled
          placeholder={placeholder ?? 'Short answer'}
          className="mt-2 cursor-default"
        />
      );

    case 'long_text':
      return (
        <Textarea
          disabled
          placeholder={placeholder ?? 'Long answer…'}
          rows={3}
          className="mt-2 cursor-default resize-none"
        />
      );

    case 'email':
      return (
        <Input
          disabled
          type="email"
          placeholder={placeholder ?? 'your@email.com'}
          className="mt-2 cursor-default"
        />
      );

    case 'phone':
      return (
        <Input
          disabled
          type="tel"
          placeholder={placeholder ?? '+1 (555) 000-0000'}
          className="mt-2 cursor-default"
        />
      );

    case 'url':
      return (
        <Input
          disabled
          type="url"
          placeholder={placeholder ?? 'https://example.com'}
          className="mt-2 cursor-default"
        />
      );

    case 'number':
      return (
        <Input
          type="number"
          disabled
          placeholder={placeholder ?? '0'}
          className="mt-2 cursor-default"
        />
      );

    case 'date':
      return (
        <Button
          variant="outline"
          disabled
          className="text-muted-foreground mt-2 w-full justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {placeholder ?? 'Pick a date'}
        </Button>
      );

    case 'time':
      return <Input type="time" disabled className="mt-2 cursor-default" />;

    case 'single_choice':
      return <SingleChoicePreview field={field} placeholder={placeholder} />;

    case 'multiple_choice':
      return <MultipleChoicePreview field={field} />;

    case 'select':
      return <SelectPreview field={field} placeholder={placeholder} />;

    case 'rating':
      return <RatingPreview max={field.validation?.max ?? 5} />;

    case 'yes_no':
      return (
        <div className="mt-2 flex gap-3">
          <Button variant="outline" disabled className="flex-1">
            Yes
          </Button>
          <Button variant="outline" disabled className="flex-1">
            No
          </Button>
        </div>
      );

    case 'linear_scale':
      return (
        <LinearScalePreview
          from={field.validation?.scaleFrom ?? 1}
          to={field.validation?.scaleTo ?? 5}
          jump={field.validation?.scaleJump ?? 1}
        />
      );

    case 'code':
      return <CodePreview field={field} placeholder={placeholder} />;

    case 'heading': {
      const level = field.headingLevel ?? 'h2';
      const align = field.textAlign ?? 'left';
      const Tag = level;
      return (
        <Tag
          className={cn('mt-1 leading-tight', HEADING_CLASSES[level], TEXT_ALIGN_CLASSES[align])}
        >
          {field.label || 'Heading'}
        </Tag>
      );
    }

    case 'description': {
      const align = field.textAlign ?? 'left';
      return (
        <p
          className={cn(
            'text-muted-foreground mt-1 text-sm leading-relaxed',
            TEXT_ALIGN_CLASSES[align],
          )}
        >
          {field.label || 'Description'}
        </p>
      );
    }

    case 'divider':
      return (
        <div
          role="separator"
          aria-orientation="horizontal"
          className="bg-muted-foreground/50 my-4 h-px w-full"
        />
      );

    case 'space': {
      const height = field.height ?? 32;
      return (
        <div
          aria-hidden
          className="border-muted-foreground/30 bg-muted/30 mt-1 flex items-center justify-center rounded-md border border-dashed"
          style={{ height: `${height}px` }}
        >
          <span className="text-muted-foreground/60 font-mono text-[10px] tabular-nums">
            {height}px
          </span>
        </div>
      );
    }

    case 'file':
      return (
        <Button
          variant="outline"
          disabled
          className="text-muted-foreground mt-2 w-full justify-start font-normal"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {field.placeholder ?? 'Choose a file (max 4 MiB)'}
        </Button>
      );
  }
}

export const FieldEditPreview = memo(FieldEditPreviewImpl);

interface ChoicePreviewProps {
  field: FormField;
  placeholder: string | undefined;
}

const SingleChoicePreview = memo(function SingleChoicePreview({
  field,
  placeholder,
}: ChoicePreviewProps) {
  const options = field.options ?? [];
  if (options.length === 0) return NO_OPTIONS_HINT;

  if (field.variant === 'select') {
    return (
      <Select disabled>
        <SelectTrigger className="mt-2">
          <SelectValue placeholder={placeholder ?? 'Select an option'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <RadioGroup disabled className="mt-2 flex flex-col gap-2">
      {options.map((opt) => (
        <div key={opt.id} className="flex items-center gap-2">
          <RadioGroupItem value={opt.value} id={`edit-${field.id}-${opt.id}`} disabled />
          <Label htmlFor={`edit-${field.id}-${opt.id}`} className="text-foreground/70 font-normal">
            {opt.label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
});

const MultipleChoicePreview = memo(function MultipleChoicePreview({ field }: { field: FormField }) {
  const options = field.options ?? [];
  if (options.length === 0) return NO_OPTIONS_HINT;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {options.map((opt) => (
        <div key={opt.id} className="flex items-center gap-2">
          <Checkbox id={`edit-mc-${field.id}-${opt.id}`} disabled />
          <Label
            htmlFor={`edit-mc-${field.id}-${opt.id}`}
            className="text-foreground/70 font-normal"
          >
            {opt.label}
          </Label>
        </div>
      ))}
    </div>
  );
});

const SelectPreview = memo(function SelectPreview({
  field,
  placeholder,
}: {
  field: FormField;
  placeholder: string | undefined;
}) {
  const options = field.options ?? [];
  if (options.length === 0) return NO_OPTIONS_HINT;
  return (
    <Select disabled>
      <SelectTrigger className="mt-2">
        <SelectValue placeholder={placeholder ?? 'Select an option'} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

const RatingPreview = memo(function RatingPreview({ max }: { max: number }) {
  const stars = useMemo(() => Array.from({ length: max }, (_, i) => i), [max]);
  return (
    <div className="mt-2 flex gap-1">
      {stars.map((i) => (
        <Star key={i} className="text-muted-foreground/50 h-6 w-6" />
      ))}
    </div>
  );
});

const LinearScalePreview = memo(function LinearScalePreview({
  from,
  to,
  jump,
}: {
  from: number;
  to: number;
  jump: number;
}) {
  const steps = useMemo(() => {
    const out: number[] = [];
    for (let i = from; i <= to; i += jump) out.push(i);
    return out;
  }, [from, to, jump]);
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {steps.map((n) => (
        <Button key={n} variant="outline" size="icon" disabled>
          {n}
        </Button>
      ))}
    </div>
  );
});

const CodePreview = memo(function CodePreview({
  field,
  placeholder,
}: {
  field: FormField;
  placeholder: string | undefined;
}) {
  const isAuto = field.codeLanguage === AUTO_DETECT_KEY;
  const badgeLabel = useMemo(
    () => (isAuto ? 'Auto-detect' : getCodeLanguage(field.codeLanguage).label),
    [isAuto, field.codeLanguage],
  );
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="text-muted-foreground flex items-center text-xs">
        <span className="bg-muted inline-flex items-center rounded px-1.5 py-0.5 font-mono">
          {badgeLabel}
        </span>
      </div>
      <div className="pointer-events-none">
        <CodeEditor
          value={field.defaultValue ?? ''}
          language={field.codeLanguage}
          placeholder={placeholder ?? 'Write your code…'}
          readOnly
          minHeight="6rem"
          maxHeight="12rem"
        />
      </div>
    </div>
  );
});
