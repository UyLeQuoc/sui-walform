'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { useFormBuilderStore } from '../../store/form-builder-store';
import type { FormField } from '../../../types';
import { CoverImageEditor } from './CoverImage';
import { FieldBlock } from './FieldBlock';
import { FormHeader } from './FormHeader';
import { SubmitButtonBlock } from './SubmitButtonBlock';

interface FormCardProps {
  formAreaStyle: React.CSSProperties;
  /**
   * 0-based index where a palette drop is currently hovering. Used to draw the
   * blue insertion indicator. null = no palette drag in progress or no valid
   * drop target hovered.
   */
  paletteDropIndex: number | null;
  isPaletteDragging: boolean;
}

/**
 * The white, rounded, shadowed form card rendered at the center of the
 * canvas. Hosts the form title, the sortable field list, and the submit
 * button. Acts as the top-level droppable for palette drags.
 */
export function FormCard({ formAreaStyle, paletteDropIndex, isPaletteDragging }: FormCardProps) {
  const { schema, selectedFieldId, isSubmitSelected, isCoverSelected } = useFormBuilderStore();
  const clearSelection = useFormBuilderStore((s) => s.clearSelection);
  const fields = schema.fields;
  const isPageMode = (schema.settings.displayMode ?? 'card') === 'page';

  // Clicking the wrapper's own empty area (the horizontal margins visible
  // because the card is max-w-2xl inside a max-w-4xl wrapper) clears the
  // current selection, matching the dotted-canvas behavior.
  const handleEmptyClick = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (e.target === e.currentTarget) {
      clearSelection();
    }
  };

  const { setNodeRef: setCardDroppableRef, isOver: isOverCard } = useDroppable({
    id: 'form-card',
    data: { source: 'form-card' },
  });

  const { setNodeRef: setEndDropRef } = useDroppable({
    id: 'form-card-end',
    data: { source: 'form-card-end' },
  });

  const anySelected = !!selectedFieldId || isSubmitSelected || isCoverSelected;

  // Indicator rendering helper — matches the feel of the drop zone.
  const Indicator = () => (
    <div
      aria-hidden
      className="bg-primary pointer-events-none mx-3 h-0.5 rounded-full shadow-[0_0_0_2px_rgba(59,130,246,0.2)]"
    />
  );

  return (
    <div
      className="flex w-full max-w-4xl flex-col items-center"
      style={formAreaStyle}
      data-form-wrapper
      onPointerDown={handleEmptyClick}
    >
      {/* Cover image — rendered outside (and wider than) the form card so it
          reads as a banner. Fixed aspect-cover ratio, not draggable. */}
      <div
        className={cn(
          'mb-4 w-full transition-[filter,opacity] duration-200',
          anySelected && !isCoverSelected && 'opacity-60 blur-[1.5px]',
        )}
      >
        <CoverImageEditor />
      </div>

      <div
        ref={setCardDroppableRef}
        className={cn(
          'bg-card relative w-full max-w-2xl rounded-xl transition-colors duration-150',
          isPageMode ? 'border-transparent' : 'border shadow-xl',
          isOverCard && isPaletteDragging && 'ring-primary/30 ring-2 ring-offset-2',
        )}
        data-form-card
      >
        {/* Header inset matches the fields (outer px-3 + FormHeader's inner px-3 = 24px). */}
        <div className="px-3 pt-8 pb-6">
          <FormHeader key={schema.id} />
        </div>

        <div className="flex flex-col px-3">
          {fields.length === 0 ? (
            <div
              ref={setEndDropRef}
              className={cn(
                'text-muted-foreground/80 mx-3 flex min-h-32 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-sm transition-colors',
                isPaletteDragging && 'border-primary/60 bg-primary/5 text-primary',
              )}
            >
              <p className="font-medium">
                {isPaletteDragging ? 'Drop to add field' : 'Drag a field from the left to start'}
              </p>
              <p className="text-muted-foreground/60 text-xs">
                or click any field in the palette to add it
              </p>
            </div>
          ) : (
            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <FieldListWithIndicators
                fields={fields}
                paletteDropIndex={paletteDropIndex}
                isPaletteDragging={isPaletteDragging}
                anySelected={anySelected}
                selectedFieldId={selectedFieldId}
                renderIndicator={() => <Indicator />}
              />
              {/* Trailing drop zone — visible only during a palette drag so the
                  submit button sits flush under the last field the rest of the
                  time. `useDroppable` is registered at the top of FormCard, so
                  toggling the DOM element doesn't break drop-target measurement. */}
              <div
                ref={setEndDropRef}
                className={cn(
                  'mx-3 overflow-hidden rounded-md border-2 border-dashed transition-all',
                  isPaletteDragging
                    ? 'border-primary/40 bg-primary/5 mt-2 h-10'
                    : 'h-0 border-transparent',
                )}
              />
            </SortableContext>
          )}
        </div>

        <div className="px-3 pb-6">
          <div
            className={cn(
              'transition-[filter,opacity] duration-200',
              anySelected && !isSubmitSelected && 'opacity-60 blur-[1.5px]',
            )}
          >
            <SubmitButtonBlock />
          </div>
        </div>
      </div>
    </div>
  );
}

interface FieldListProps {
  fields: FormField[];
  paletteDropIndex: number | null;
  isPaletteDragging: boolean;
  anySelected: boolean;
  selectedFieldId: string | null;
  renderIndicator: () => ReactNode;
}

function FieldListWithIndicators({
  fields,
  paletteDropIndex,
  isPaletteDragging,
  anySelected,
  selectedFieldId,
  renderIndicator,
}: FieldListProps) {
  return (
    <div className="flex flex-col">
      {fields.map((field, index) => {
        const showIndicatorAbove = isPaletteDragging && paletteDropIndex === index;
        const isDimmed = anySelected && selectedFieldId !== field.id;
        return (
          <div key={field.id} data-field-id={field.id}>
            {showIndicatorAbove && renderIndicator()}
            <div
              className={cn(
                'transition-[filter,opacity] duration-200',
                isDimmed && 'opacity-60 blur-[1.5px]',
              )}
            >
              <FieldBlock field={field} index={index} />
            </div>
          </div>
        );
      })}
      {isPaletteDragging && paletteDropIndex === fields.length && renderIndicator()}
    </div>
  );
}
