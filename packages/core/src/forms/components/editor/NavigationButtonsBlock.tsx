/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../ui/button';
import { cn } from '../../../lib/utils';
import { DEFAULT_NAVIGATION } from '../../lib/pages';
import { useFormBuilderStore } from '../../store/form-builder-store';

interface NavigationButtonsBlockProps {
  /** True for the first page — Previous button is suppressed (matches runtime). */
  isFirstPage: boolean;
}

/**
 * Canvas representation of the Previous / Next button row rendered by
 * `<FormPreview>` on non-last pages. Selecting it opens `SubmitSettingsPanel`,
 * which is where all three button labels (Previous, Next, Submit) and the
 * shared alignment/width live.
 */
export function NavigationButtonsBlock({ isFirstPage }: NavigationButtonsBlockProps) {
  const { schema, isSubmitSelected, setIsSubmitSelected } = useFormBuilderStore();
  const { settings } = schema;
  const alignment = settings.submitAlignment ?? 'left';
  const navigation = { ...DEFAULT_NAVIGATION, ...(settings.navigation ?? {}) };
  const nextLabel = settings.nextLabel?.trim() || 'Next';
  const previousLabel = settings.previousLabel?.trim() || 'Previous';
  const isCenter = alignment === 'center';
  const showPrevious = navigation.allowBack && !isFirstPage;
  const buttonWidthClass = isCenter ? 'flex-1' : '';

  return (
    <div
      onClick={() => setIsSubmitSelected(true)}
      className={cn(
        'hover:bg-accent/40 relative cursor-pointer rounded-md px-3 py-2 transition-colors',
        isSubmitSelected &&
          'bg-accent/40 ring-primary/50 ring-offset-card ring-[3px] ring-offset-2',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2',
          alignment === 'right' && 'justify-end',
          alignment === 'left' && 'justify-start',
          isCenter && 'justify-stretch',
        )}
      >
        {showPrevious && (
          <Button
            type="button"
            variant="outline"
            tabIndex={-1}
            className={cn('pointer-events-none', buttonWidthClass)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {previousLabel}
          </Button>
        )}
        <Button
          type="button"
          tabIndex={-1}
          className={cn('pointer-events-none', buttonWidthClass)}
        >
          {nextLabel}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
