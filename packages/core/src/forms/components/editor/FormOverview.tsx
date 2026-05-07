'use client';

import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, GripVertical, Hash, Minus } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { ScrollHintArea } from '../../../ui/scroll-hint-area';
import { useOutline } from '../../hooks/use-outline';
import { OUTLINE_DRAG_PREFIX } from '../../lib/drag-ids';
import { getOutlineLabel } from '../../lib/outline';
import type { FormField } from '../../../types';
import { FieldTypeIcon } from '../FieldTypeIcon';

export { OUTLINE_DRAG_PREFIX };

/**
 * Flat outline for the form — each field is one row in document order,
 * no indentation or hierarchy guides. The entire row is a sortable drag
 * activator: a short click selects (dnd-kit's pointer sensor has an
 * activation distance), holding and moving drags to reorder.
 */
export function FormOverview() {
  const { fields, title, selectedFieldId, inputCount, sectionCount, sortableIds, pickField } =
    useOutline();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Hash className="text-muted-foreground h-3.5 w-3.5" />
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Outline
          </p>
        </div>
        <p className="mt-1 truncate text-sm font-semibold">{title || 'Untitled Form'}</p>
        <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1">
            <span className="bg-muted-foreground/40 size-1.5 rounded-full" />
            {inputCount} {inputCount === 1 ? 'field' : 'fields'}
          </span>
          {sectionCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="bg-primary size-1.5 rounded-full" />
              {sectionCount} {sectionCount === 1 ? 'section' : 'sections'}
            </span>
          )}
        </div>
      </div>

      <ScrollHintArea className="min-h-0 flex-1">
        <div className="py-2">
          {fields.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <FileText className="text-muted-foreground/40 h-7 w-7" />
              <p className="text-muted-foreground text-xs leading-relaxed">
                No fields yet. Drag field types from the left to build your form.
              </p>
            </div>
          ) : (
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-px px-2">
                {fields.map((field, index) => (
                  <OverviewRow
                    key={field.id}
                    field={field}
                    index={index}
                    selected={selectedFieldId === field.id}
                    onSelect={pickField}
                  />
                ))}
              </ol>
            </SortableContext>
          )}
        </div>
      </ScrollHintArea>
    </div>
  );
}

interface OverviewRowProps {
  field: FormField;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}

const OverviewRow = memo(function OverviewRow({
  field,
  index,
  selected,
  onSelect,
}: OverviewRowProps) {
  const isSection = field.type === 'heading';
  const isDivider = field.type === 'divider';
  const isSpace = field.type === 'space';
  const isHelper = field.type === 'description' || field.type === 'markdown';
  const label = getOutlineLabel(field);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${OUTLINE_DRAG_PREFIX}${field.id}` });

  const style = useMemo<React.CSSProperties>(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
    }),
    [transform, transition],
  );

  const handleSelect = useCallback(() => onSelect(field.id), [onSelect, field.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(field.id);
      }
    },
    [onSelect, field.id],
  );

  return (
    <li ref={setNodeRef} style={style} className={cn(isDragging && 'opacity-40')}>
      {/* Whole row is the drag activator — pointer sensor's activation distance
          still allows a short click to select without starting a drag. */}
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={`${label} — click to select, drag to reorder`}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        className={cn(
          'group relative flex w-full cursor-grab items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors outline-none select-none active:cursor-grabbing',
          'focus-visible:ring-ring focus-visible:ring-2',
          selected ? 'bg-primary/10 ring-primary/40 ring-1' : 'hover:bg-accent/60',
        )}
      >
        <span
          aria-hidden
          className="text-muted-foreground/40 group-hover:text-muted-foreground flex w-4 shrink-0 items-center justify-center"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>

        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded',
            isSection && 'bg-primary/10 text-primary',
            !isSection &&
              !isDivider &&
              !isSpace &&
              (selected ? 'text-primary' : 'text-muted-foreground/80'),
            (isDivider || isSpace) && 'text-muted-foreground/60',
          )}
        >
          {isDivider ? (
            <Minus className="h-3.5 w-3.5" />
          ) : (
            <FieldTypeIcon type={field.type} className="h-3.5 w-3.5" />
          )}
        </span>

        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            isSection && 'font-semibold',
            isHelper && 'text-muted-foreground italic',
            (isDivider || isSpace) && 'text-muted-foreground/70',
          )}
        >
          {label}
        </span>

        {field.required && (
          <span title="Required" className="text-destructive shrink-0 text-xs leading-none">
            *
          </span>
        )}
        <span
          className={cn(
            'text-muted-foreground/50 shrink-0 font-mono text-[10px] tabular-nums transition-opacity',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          {index + 1}
        </span>
      </div>
    </li>
  );
});
