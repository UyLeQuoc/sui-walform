'use client';

import { useDraggable } from '@dnd-kit/core';
import { cn } from '../../../lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../ui/accordion';
import { Input } from '../../../ui/input';
import { ScrollHintArea } from '../../../ui/scroll-hint-area';
import { usePaletteSearch } from '../../hooks/use-palette-search';
import { PALETTE_DRAG_PREFIX } from '../../lib/drag-ids';
import { FIELD_TYPE_GROUPS, type FieldTypeGroup, type FieldTypeMeta } from '../../lib/field-types';
import { useFormBuilderStore } from '../../store/form-builder-store';
import { FieldTypeIcon } from '../FieldTypeIcon';

export { PALETTE_DRAG_PREFIX };

function PaletteCard({ meta }: { meta: FieldTypeMeta }) {
  const addField = useFormBuilderStore((s) => s.addField);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_DRAG_PREFIX}${meta.type}`,
    data: { source: 'palette', fieldType: meta.type },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => addField(meta.type)}
      {...attributes}
      {...listeners}
      className={cn(
        'group/palette-card bg-card hover:bg-accent/60 hover:border-border flex w-full cursor-grab touch-none items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-colors active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
      aria-label={`Drag ${meta.label} onto the canvas or click to add`}
    >
      <span className="bg-muted/60 text-muted-foreground group-hover/palette-card:bg-background flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
        <FieldTypeIcon type={meta.type} className="h-4 w-4" />
      </span>
      <span className="truncate font-medium">{meta.label}</span>
    </button>
  );
}

const GROUP_DISPLAY: Record<FieldTypeGroup, string> = {
  Inputs: 'Text Inputs',
  Choices: 'Selection',
  'Date & Time': 'Date & Time',
  Layout: 'Layout',
};

export function FieldPaletteSidebar() {
  const { query, setQuery, searching, searchResults, grouped, openGroups, setOpenGroups } =
    usePaletteSearch();

  return (
    <aside
      className={cn(
        'bg-background/80 supports-backdrop-filter:bg-background/60 flex h-full w-[260px] shrink-0 flex-col border-r backdrop-blur',
      )}
      aria-label="Field palette"
    >
      <div className="border-b px-3 py-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Field Palette
        </p>
        <p className="text-muted-foreground/80 mt-0.5 text-xs">Drag fields onto the canvas</p>
        <div className="mt-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fields…"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <ScrollHintArea className="min-h-0 flex-1">
        <div className="px-2 py-2">
          {searching ? (
            <div className="flex flex-col gap-1">
              {searchResults.length === 0 ? (
                <p className="text-muted-foreground px-2 py-4 text-center text-xs">
                  No fields match &ldquo;{query}&rdquo;
                </p>
              ) : (
                searchResults.map((meta) => <PaletteCard key={meta.type} meta={meta} />)
              )}
            </div>
          ) : (
            <Accordion
              type="multiple"
              value={openGroups}
              onValueChange={setOpenGroups}
              className="flex flex-col gap-1"
            >
              {FIELD_TYPE_GROUPS.map((group) => {
                const items = grouped[group];
                if (items.length === 0) return null;
                return (
                  <AccordionItem key={group} value={group} className="border-b-0">
                    <AccordionTrigger className="hover:bg-accent/40 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold tracking-wide uppercase hover:no-underline">
                      <span className="text-muted-foreground">{GROUP_DISPLAY[group]}</span>
                      <span className="text-muted-foreground/60 mr-1 ml-auto text-[10px] font-normal normal-case">
                        {items.length}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-2">
                      <div className="flex flex-col gap-0.5">
                        {items.map((meta) => (
                          <PaletteCard key={meta.type} meta={meta} />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </ScrollHintArea>
    </aside>
  );
}
