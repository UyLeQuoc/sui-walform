'use client';

import { format } from 'date-fns';
import { CalendarIcon, Trash2 } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Calendar } from '../../../../ui/calendar';
import { Field, FieldLabel } from '../../../../ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../ui/popover';
import { cn } from '../../../../lib/utils';
import { useFormBuilderStore } from '../../../store/form-builder-store';
import type { FormField } from '../../../../types';

interface DateSettingsProps {
  field: FormField;
}

export function DateSettings({ field }: DateSettingsProps) {
  const updateField = useFormBuilderStore((s) => s.updateField);
  const defaultDate = field.defaultValue ? new Date(field.defaultValue) : undefined;
  const minDate = field.validation?.minDate ? new Date(field.validation.minDate) : undefined;
  const maxDate = field.validation?.maxDate ? new Date(field.validation.maxDate) : undefined;

  return (
    <>
      <Field>
        <FieldLabel>Default date</FieldLabel>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'flex-1 justify-start text-left font-normal',
                  !defaultDate && 'text-muted-foreground',
                )}
              >
                <CalendarIcon data-icon="inline-start" />
                {defaultDate ? format(defaultDate, 'PPP') : 'Pick a default date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={defaultDate}
                disabled={[
                  ...(minDate ? [{ before: minDate }] : []),
                  ...(maxDate ? [{ after: maxDate }] : []),
                ]}
                onSelect={(date) => updateField(field.id, { defaultValue: date?.toISOString() })}
              />
            </PopoverContent>
          </Popover>
          {defaultDate && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => updateField(field.id, { defaultValue: undefined })}
            >
              <Trash2 />
              <span className="sr-only">Clear date</span>
            </Button>
          )}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel>Min date</FieldLabel>
          <div className="flex gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'flex-1 justify-start text-left font-normal',
                    !minDate && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon data-icon="inline-start" />
                  {minDate ? format(minDate, 'PP') : 'No min'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={minDate}
                  disabled={maxDate ? [{ after: maxDate }] : undefined}
                  onSelect={(date) =>
                    updateField(field.id, {
                      validation: {
                        ...field.validation,
                        minDate: date?.toISOString(),
                      },
                    })
                  }
                />
              </PopoverContent>
            </Popover>
            {minDate && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  updateField(field.id, {
                    validation: { ...field.validation, minDate: undefined },
                  })
                }
              >
                <Trash2 />
                <span className="sr-only">Clear min date</span>
              </Button>
            )}
          </div>
        </Field>
        <Field>
          <FieldLabel>Max date</FieldLabel>
          <div className="flex gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'flex-1 justify-start text-left font-normal',
                    !maxDate && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon data-icon="inline-start" />
                  {maxDate ? format(maxDate, 'PP') : 'No max'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={maxDate}
                  disabled={minDate ? [{ before: minDate }] : undefined}
                  onSelect={(date) =>
                    updateField(field.id, {
                      validation: {
                        ...field.validation,
                        maxDate: date?.toISOString(),
                      },
                    })
                  }
                />
              </PopoverContent>
            </Popover>
            {maxDate && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  updateField(field.id, {
                    validation: { ...field.validation, maxDate: undefined },
                  })
                }
              >
                <Trash2 />
                <span className="sr-only">Clear max date</span>
              </Button>
            )}
          </div>
        </Field>
      </div>
    </>
  );
}
