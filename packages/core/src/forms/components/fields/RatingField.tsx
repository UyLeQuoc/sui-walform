'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';
import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { cn } from '../../../lib/utils';
import { PreviewField } from '../preview/PreviewField';
import type { FormField } from '../../../types';

interface RatingFieldProps {
  field: FormField;
  control: Control<FieldValues>;
}

export function RatingField({ field, control }: RatingFieldProps) {
  const maxStars = field.validation?.max ?? 5;

  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf, fieldState }) => {
        const value = typeof rhf.value === 'number' ? rhf.value : 0;
        return (
          <PreviewField field={field} error={fieldState.error?.message}>
            <StarRow maxStars={maxStars} value={value} onChange={rhf.onChange} />
          </PreviewField>
        );
      }}
    />
  );
}

interface StarRowProps {
  maxStars: number;
  value: number;
  onChange: (v: number) => void;
}

function StarRow({ maxStars, value, onChange }: StarRowProps) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  return (
    <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
      {Array.from({ length: maxStars }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          className="focus-visible:ring-ring rounded focus-visible:ring-2 focus-visible:outline-none"
          aria-label={`Rate ${star} out of ${maxStars}`}
        >
          <Star
            className={cn(
              'size-6 transition-colors',
              star <= active ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/50',
            )}
          />
        </button>
      ))}
    </div>
  );
}
