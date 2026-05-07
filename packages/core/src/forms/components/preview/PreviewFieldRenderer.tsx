'use client';

import { memo } from 'react';
import type { Control, FieldValues } from 'react-hook-form';
import type { FormField } from '../../../types';
import { CodeField } from '../fields/CodeField';
import { DateField } from '../fields/DateField';
import { DescriptionField } from '../fields/DescriptionField';
import { EmailField } from '../fields/EmailField';
import { FileField } from '../fields/FileField';
import { HeadingField } from '../fields/HeadingField';
import { LinearScaleField } from '../fields/LinearScaleField';
import { LongTextField } from '../fields/LongTextField';
import { MarkdownField } from '../fields/MarkdownField';
import { MultipleChoiceField } from '../fields/MultipleChoiceField';
import { NumberField } from '../fields/NumberField';
import { PhoneField } from '../fields/PhoneField';
import { RatingField } from '../fields/RatingField';
import { SelectField } from '../fields/SelectField';
import { ShortTextField } from '../fields/ShortTextField';
import { SingleChoiceField } from '../fields/SingleChoiceField';
import { TimeField } from '../fields/TimeField';
import { UrlField } from '../fields/UrlField';
import { YesNoField } from '../fields/YesNoField';

interface PreviewFieldRendererProps {
  field: FormField;
  control: Control<FieldValues>;
}

/**
 * Maps a `FormField` to its preview renderer. Layout types (heading,
 * description, markdown, divider, space) are pure display and don't
 * receive `control`; everything else is a form input bound to RHF.
 */
function PreviewFieldRendererImpl({ field, control }: PreviewFieldRendererProps) {
  switch (field.type) {
    case 'short_text':
      return <ShortTextField field={field} control={control} />;
    case 'long_text':
      return <LongTextField field={field} control={control} />;
    case 'email':
      return <EmailField field={field} control={control} />;
    case 'phone':
      return <PhoneField field={field} control={control} />;
    case 'url':
      return <UrlField field={field} control={control} />;
    case 'single_choice':
      return <SingleChoiceField field={field} control={control} />;
    case 'multiple_choice':
      return <MultipleChoiceField field={field} control={control} />;
    case 'number':
      return <NumberField field={field} control={control} />;
    case 'date':
      return <DateField field={field} control={control} />;
    case 'time':
      return <TimeField field={field} control={control} />;
    case 'select':
      return <SelectField field={field} control={control} />;
    case 'rating':
      return <RatingField field={field} control={control} />;
    case 'yes_no':
      return <YesNoField field={field} control={control} />;
    case 'linear_scale':
      return <LinearScaleField field={field} control={control} />;
    case 'code':
      return <CodeField field={field} control={control} />;
    case 'file':
      return <FileField field={field} control={control} />;
    case 'heading':
      return <HeadingField field={field} />;
    case 'description':
      return <DescriptionField field={field} />;
    case 'markdown':
      return <MarkdownField field={field} />;
    case 'divider':
      return (
        <div
          role="separator"
          aria-orientation="horizontal"
          className="bg-muted-foreground/50 my-4 h-px w-full"
        />
      );
    case 'space':
      return <div aria-hidden style={{ height: `${field.height ?? 32}px` }} />;
  }
}

export const PreviewFieldRenderer = memo(PreviewFieldRendererImpl);
