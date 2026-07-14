'use client';

import { memo, useCallback, useMemo } from 'react';
import { LayersPlus, Trash2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button } from '../../../ui/button';
import { Field, FieldGroup, FieldLabel } from '../../../ui/field';
import { Input } from '../../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { useSelectedField } from '../../hooks/use-selected-field';
import { getFieldSettingsConfig } from '../../lib/field-settings-config';
import { FIELD_TYPES } from '../../lib/field-types';
import { useFormBuilderStore } from '../../store/form-builder-store';
import { FieldTypeIcon } from '../FieldTypeIcon';
import { CodeSettings } from './field-settings/CodeSettings';
import { CommonFields } from './field-settings/CommonFields';
import { DateSettings } from './field-settings/DateSettings';
import { FileSettings } from './field-settings/FileSettings';
import { LayoutContentSettings } from './field-settings/LayoutContentSettings';
import { LinearScaleSettings } from './field-settings/LinearScaleSettings';
import { NumberValidation } from './field-settings/NumberValidation';
import { OptionsEditor } from './field-settings/OptionsEditor';
import { PhoneSettings } from './field-settings/PhoneSettings';
import { RatingSettings } from './field-settings/RatingSettings';
import { TextValidation } from './field-settings/TextValidation';
import { UrlSettings } from './field-settings/UrlSettings';

interface FieldSettingsProps {
  className?: string;
}

function EmptyState({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="border-b px-4 py-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Properties
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
        <div className="text-muted-foreground/80 flex flex-col items-center gap-2">
          <div className="bg-muted/60 flex h-10 w-10 items-center justify-center rounded-full">
            <span className="text-lg">✎</span>
          </div>
          <p className="text-sm font-medium">Select a field</p>
          <p className="text-muted-foreground/60 text-xs leading-relaxed">
            Click any field on the canvas to edit its label, placeholder, and validation rules.
          </p>
        </div>
      </div>
    </div>
  );
}

interface ActionButtonsProps {
  onDuplicate: () => void;
  onDelete: () => void;
}

const ActionButtons = memo(function ActionButtons({ onDuplicate, onDelete }: ActionButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" className="flex-1" onClick={onDuplicate}>
        <LayersPlus data-icon="inline-start" />
        Duplicate
      </Button>
      <Button variant="destructive" className="flex-1" onClick={onDelete}>
        <Trash2 data-icon="inline-start" />
        Delete
      </Button>
    </div>
  );
});

/**
 * Right-sidebar field properties panel. Shows an empty state when no field
 * is selected, otherwise renders type-appropriate settings for the selected
 * field.
 */
export function FieldSettings({ className }: FieldSettingsProps) {
  const { field, remove, duplicate, deselect } = useSelectedField();
  const updateField = useFormBuilderStore((s) => s.updateField);

  const fieldType = field?.type;
  const meta = useMemo(
    () => (fieldType ? FIELD_TYPES.find((m) => m.type === fieldType) : undefined),
    [fieldType],
  );
  const config = useMemo(() => (fieldType ? getFieldSettingsConfig(fieldType) : null), [fieldType]);

  const handleSpaceHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!field) return;
      const next = Number(e.target.value);
      if (Number.isFinite(next) && next > 0) {
        updateField(field.id, { height: next });
      }
    },
    [field, updateField],
  );

  const handleDefaultTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!field) return;
      updateField(field.id, { defaultValue: e.target.value || undefined });
    },
    [field, updateField],
  );

  const handleVariantChange = useCallback(
    (v: string) => {
      if (!field) return;
      updateField(field.id, { variant: v as 'radio' | 'select' });
    },
    [field, updateField],
  );

  if (!field || !config) return <EmptyState className={className} />;

  const actions = <ActionButtons onDuplicate={duplicate} onDelete={remove} />;

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="bg-muted/60 flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
          <FieldTypeIcon type={field.type} className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{meta?.label ?? 'Field'}</p>
          <p className="text-muted-foreground truncate text-xs">Properties</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Deselect field"
          onClick={deselect}
          className="h-7 w-7"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <FieldGroup>
          {field.type === 'divider' && actions}

          {field.type === 'space' && (
            <>
              <Field>
                <FieldLabel htmlFor="space-height">Height (px)</FieldLabel>
                <Input
                  id="space-height"
                  type="number"
                  min={4}
                  max={400}
                  step={4}
                  value={field.height ?? 32}
                  onChange={handleSpaceHeightChange}
                />
              </Field>
              {actions}
            </>
          )}

          {(field.type === 'heading' ||
            field.type === 'description' ||
            field.type === 'markdown') && (
            <>
              <LayoutContentSettings field={field} />
              {actions}
            </>
          )}

          {!config.isLayout && (
            <>
              <CommonFields
                field={field}
                showPlaceholder={config.showPlaceholder}
                showDefaultText={config.showDefaultText}
                placeholderHint={config.placeholderHint}
              />

              {field.type === 'time' && (
                <Field>
                  <FieldLabel htmlFor="field-default-time">Default time</FieldLabel>
                  <Input
                    id="field-default-time"
                    type="time"
                    value={field.defaultValue ?? ''}
                    onChange={handleDefaultTimeChange}
                  />
                </Field>
              )}

              {field.type === 'date' && <DateSettings field={field} />}
              {field.type === 'phone' && <PhoneSettings field={field} />}
              {field.type === 'url' && <UrlSettings field={field} />}

              {field.type === 'single_choice' && (
                <Field>
                  <FieldLabel>Display as</FieldLabel>
                  <Select value={field.variant ?? 'radio'} onValueChange={handleVariantChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="radio">Radio buttons</SelectItem>
                      <SelectItem value="select">Dropdown</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {(field.type === 'single_choice' ||
                field.type === 'multiple_choice' ||
                field.type === 'select') && <OptionsEditor field={field} />}

              {field.type === 'rating' && <RatingSettings field={field} />}
              {field.type === 'linear_scale' && <LinearScaleSettings field={field} />}
              {(field.type === 'short_text' || field.type === 'long_text') && (
                <TextValidation field={field} />
              )}
              {field.type === 'number' && <NumberValidation field={field} />}
              {field.type === 'code' && <CodeSettings field={field} />}
              {field.type === 'file' && <FileSettings field={field} />}

              {actions}
            </>
          )}
        </FieldGroup>
      </div>
    </div>
  );
}
