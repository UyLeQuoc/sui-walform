'use client';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Strikethrough,
  Underline,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Field, FieldLabel } from '../../../../ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Textarea } from '../../../../ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '../../../../ui/toggle-group';
import { useFormBuilderStore } from '../../../store/form-builder-store';
import type { FormField } from '../../../../types';

type StyleProp = 'fontBold' | 'fontItalic' | 'fontUnderline' | 'fontStrikethrough';

const STYLE_TOGGLES: { prop: StyleProp; icon: LucideIcon; label: string }[] = [
  { prop: 'fontBold', icon: Bold, label: 'Bold' },
  { prop: 'fontItalic', icon: Italic, label: 'Italic' },
  { prop: 'fontUnderline', icon: Underline, label: 'Underline' },
  { prop: 'fontStrikethrough', icon: Strikethrough, label: 'Strikethrough' },
];

function buildLayoutStyle(field: FormField): React.CSSProperties {
  const decorations: string[] = [];
  if (field.fontUnderline) decorations.push('underline');
  if (field.fontStrikethrough) decorations.push('line-through');
  return {
    fontWeight: field.fontBold ? 'bold' : undefined,
    fontStyle: field.fontItalic ? 'italic' : undefined,
    textDecoration: decorations.length > 0 ? decorations.join(' ') : undefined,
  };
}

interface LayoutContentSettingsProps {
  field: FormField;
}

export function LayoutContentSettings({ field }: LayoutContentSettingsProps) {
  const { updateField, updateFieldDeferred } = useFormBuilderStore();

  const isHeading = field.type === 'heading';
  const isMarkdown = field.type === 'markdown';

  return (
    <>
      <Field>
        <FieldLabel htmlFor="layout-content">Content</FieldLabel>
        <Textarea
          id="layout-content"
          value={field.label}
          rows={isHeading ? 2 : 4}
          onChange={(e) => updateFieldDeferred(field.id, { label: e.target.value })}
          placeholder={
            isHeading
              ? 'Heading text…'
              : isMarkdown
                ? 'Write **markdown** content…'
                : 'Description text…'
          }
          className={isMarkdown ? 'font-mono text-sm' : undefined}
          style={buildLayoutStyle(field)}
        />
      </Field>

      {isHeading && (
        <Field>
          <FieldLabel>Heading level</FieldLabel>
          <Select
            value={field.headingLevel ?? 'h2'}
            onValueChange={(v) => updateField(field.id, { headingLevel: v as 'h1' | 'h2' | 'h3' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="h1">H1 — Large</SelectItem>
              <SelectItem value="h2">H2 — Medium</SelectItem>
              <SelectItem value="h3">H3 — Small</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}

      {/* Alignment + style toggles in one row */}
      <Field>
        <FieldLabel>Format</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          {!isMarkdown && (
            <>
              <ToggleGroup
                type="single"
                variant="outline"
                value={field.textAlign ?? 'left'}
                onValueChange={(value) => {
                  if (!value) return;
                  updateField(field.id, {
                    textAlign: value as 'left' | 'center' | 'right',
                  });
                }}
              >
                <ToggleGroupItem value="left" aria-label="Align left">
                  <AlignLeft className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="center" aria-label="Align center">
                  <AlignCenter className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="right" aria-label="Align right">
                  <AlignRight className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              <div className="bg-border h-6 w-px shrink-0" />
            </>
          )}
          {STYLE_TOGGLES.map(({ prop, icon: Icon, label }) => {
            const active = !!field[prop];
            return (
              <Button
                key={prop}
                variant={active ? 'default' : 'outline'}
                size="icon"
                onClick={() => updateField(field.id, { [prop]: !active })}
                aria-label={label}
                aria-pressed={active}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>
      </Field>
    </>
  );
}
