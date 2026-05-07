'use client';

import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { Button } from '../../../ui/button';
import { Calendar } from '../../../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover';
import { cn } from '../../../lib/utils';
import { useFormRadius } from '../../lib/form-appearance-context';
import { PreviewField } from '../preview/PreviewField';
import type { FormField } from '../../../types';

interface DateFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

export function DateField({ field, control }: DateFieldProps) {
  const radius = useFormRadius();
  const radiusStyle = radius ? { borderRadius: radius } : undefined;

  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => {
        const dateValue = rhf.value instanceof Date ? rhf.value : undefined;

        return (
          <PreviewField field={field} error={fieldState.error?.message} htmlFor={field.id}>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id={field.id}
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dateValue && 'text-muted-foreground',
                  )}
                  style={radiusStyle}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateValue ? format(dateValue, 'PPP') : (field.placeholder ?? 'Pick a date')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" style={radiusStyle}>
                <Calendar mode="single" selected={dateValue} onSelect={rhf.onChange} />
              </PopoverContent>
            </Popover>
          </PreviewField>
        );
      }}
    />
  );
}
