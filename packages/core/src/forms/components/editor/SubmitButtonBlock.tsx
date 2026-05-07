/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
'use client';

import { Button } from '../../../ui/button';
import { cn } from '../../../lib/utils';
import { useFormBuilderStore } from '../../store/form-builder-store';

/**
 * Canvas representation of the form's submit button. Selecting this block
 * is mutually exclusive with field selection — the right sidebar swaps in
 * `SubmitSettingsPanel` when `isSubmitSelected` flips on. The button itself
 * is `pointer-events-none` so clicks anywhere (including its own padding
 * and the surrounding gutter) propagate up to the selectable wrapper.
 */
export function SubmitButtonBlock() {
  const { schema, isSubmitSelected, setIsSubmitSelected } = useFormBuilderStore();
  const { settings } = schema;
  const alignment = settings.submitAlignment ?? 'left';

  return (
    <div
      onClick={() => setIsSubmitSelected(true)}
      className={cn(
        'hover:bg-accent/40 relative cursor-pointer rounded-md px-3 py-2 transition-colors',
        isSubmitSelected &&
          'bg-accent/40 ring-primary/50 ring-offset-card ring-[3px] ring-offset-2',
      )}
    >
      <div className={cn('flex', alignment === 'right' && 'justify-end')}>
        <Button
          type="button"
          tabIndex={-1}
          className={cn('pointer-events-none', alignment === 'center' && 'w-full')}
        >
          {settings.submitLabel}
        </Button>
      </div>
    </div>
  );
}
