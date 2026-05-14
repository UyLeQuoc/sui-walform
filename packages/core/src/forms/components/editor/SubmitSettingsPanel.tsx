'use client';

import { AlignCenter, AlignLeft, AlignRight, CornerDownLeft, X } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Field, FieldGroup, FieldLabel } from '../../../ui/field';
import { Input } from '../../../ui/input';
import { ToggleGroup, ToggleGroupItem } from '../../../ui/toggle-group';
import { cn } from '../../../lib/utils';
import { useFormBuilderStore } from '../../store/form-builder-store';

interface SubmitSettingsPanelProps {
  className?: string;
}

/**
 * Right-sidebar properties panel for the form's submit button. Mirrors
 * `FieldSettings`' shell (header + scrollable body) so the switch between
 * the two feels seamless.
 */
export function SubmitSettingsPanel({ className }: SubmitSettingsPanelProps) {
  const { schema, updateSettings, setIsSubmitSelected } = useFormBuilderStore();
  const { settings } = schema;
  const alignment = settings.submitAlignment ?? 'left';
  const isMultiPage = (schema.pages?.length ?? 0) > 1;

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="bg-muted/60 flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
          <CornerDownLeft className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Submit button</p>
          <p className="text-muted-foreground truncate text-xs">Properties</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Deselect submit button"
          onClick={() => setIsSubmitSelected(false)}
          className="h-7 w-7"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="submit-label">Submit label</FieldLabel>
            <Input
              id="submit-label"
              value={settings.submitLabel}
              onChange={(e) => updateSettings({ submitLabel: e.target.value })}
              placeholder="Submit"
            />
          </Field>

          {isMultiPage && (
            <>
              <Field>
                <FieldLabel htmlFor="next-label">Next button label</FieldLabel>
                <Input
                  id="next-label"
                  value={settings.nextLabel ?? ''}
                  onChange={(e) => updateSettings({ nextLabel: e.target.value })}
                  placeholder="Next"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="previous-label">Previous button label</FieldLabel>
                <Input
                  id="previous-label"
                  value={settings.previousLabel ?? ''}
                  onChange={(e) => updateSettings({ previousLabel: e.target.value })}
                  placeholder="Previous"
                />
              </Field>
            </>
          )}

          <Field>
            <FieldLabel>Alignment / width</FieldLabel>
            <ToggleGroup
              type="single"
              value={alignment}
              onValueChange={(v) =>
                v &&
                updateSettings({
                  submitAlignment: v as 'left' | 'center' | 'right',
                })
              }
            >
              <ToggleGroupItem value="left">
                <AlignLeft />
                <span className="sr-only">Left</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="center">
                <AlignCenter />
                <span className="sr-only">Center (full width)</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="right">
                <AlignRight />
                <span className="sr-only">Right</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="success-message">Success message</FieldLabel>
            <Input
              id="success-message"
              value={settings.successMessage}
              onChange={(e) => updateSettings({ successMessage: e.target.value })}
              placeholder="Thank you for your response!"
            />
          </Field>
        </FieldGroup>
      </div>
    </div>
  );
}
