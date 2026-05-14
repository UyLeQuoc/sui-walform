'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { cn } from '../../../lib/utils';
import { useFormBuilderStore } from '../../store/form-builder-store';
import type { FormField, FormPage } from '../../../types';
import { CoverImageEditor } from './CoverImage';
import { FieldBlock } from './FieldBlock';
import { FormHeader } from './FormHeader';
import { NavigationButtonsBlock } from './NavigationButtonsBlock';
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

export function FormCard({ formAreaStyle, paletteDropIndex, isPaletteDragging }: FormCardProps) {
  const { schema, selectedFieldId, isSubmitSelected, isCoverSelected } = useFormBuilderStore();
  const clearSelection = useFormBuilderStore((s) => s.clearSelection);
  const addPage = useFormBuilderStore((s) => s.addPage);
  const setActivePageId = useFormBuilderStore((s) => s.setActivePageId);
  const activePageId = useFormBuilderStore((s) => s.activePageId);
  const fields = schema.fields;
  const pages = schema.pages;
  const isPageMode = (schema.settings.displayMode ?? 'card') === 'page';
  const isMultiPage = !!pages && pages.length > 0;

  // Auto-select the first page when pages are present but the active id is
  // stale (e.g. after undo restored a different page list).
  useEffect(() => {
    if (!pages || pages.length === 0) return;
    if (!activePageId || !pages.some((p) => p.id === activePageId)) {
      setActivePageId(pages[0]!.id);
    }
  }, [pages, activePageId, setActivePageId]);

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

  const Indicator = () => (
    <div
      aria-hidden
      className="bg-primary pointer-events-none mx-3 h-0.5 rounded-full shadow-[0_0_0_2px_rgba(59,130,246,0.2)]"
    />
  );

  // Pick which fields render right now — only the active page's, when pages
  // exist. Drop-indicator math stays in flat-array space so dnd-kit's
  // paletteDropIndex still works.
  const activePage =
    isMultiPage ? pages!.find((p) => p.id === activePageId) ?? pages![0]! : null;
  // Editor mirrors runtime: Submit only renders on the last page (single-page
  // forms count as "last" so Submit is always visible). Non-last multi-page
  // pages show the Previous / Next preview pair instead.
  const isLastPage = !isMultiPage || activePage?.id === pages![pages!.length - 1]!.id;
  const activePageIndex = isMultiPage && activePage ? pages!.indexOf(activePage) : 0;
  const isFirstPage = activePageIndex === 0;

  // Slide direction for the page-content transition, mirroring the
  // animation in <FormPreview> so the editor canvas and the rendered form
  // feel identical when navigating between pages.
  const prevPageIdxRef = useRef(activePageIndex);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  useEffect(() => {
    if (activePageIndex !== prevPageIdxRef.current) {
      setSlideDirection(activePageIndex > prevPageIdxRef.current ? 1 : -1);
      prevPageIdxRef.current = activePageIndex;
    }
  }, [activePageIndex]);
  const fieldsInView: FormField[] = activePage
    ? activePage.fieldIds
        .map((id) => fields.find((f) => f.id === id))
        .filter((f): f is FormField => !!f)
    : fields;
  const flatStartIndex = activePage
    ? fields.findIndex((f) => f.id === activePage.fieldIds[0]) === -1
      ? 0
      : fields.findIndex((f) => f.id === activePage.fieldIds[0])
    : 0;

  return (
    <div
      className="flex w-full max-w-4xl flex-col items-center"
      style={formAreaStyle}
      data-form-wrapper
      onPointerDown={handleEmptyClick}
    >
      <div
        className={cn(
          'mb-4 w-full transition-[filter,opacity] duration-200',
          anySelected && !isCoverSelected && 'opacity-60 blur-[1.5px]',
        )}
      >
        <CoverImageEditor />
      </div>

      <div className="relative w-full max-w-2xl">
        {isMultiPage && (
          <PageStrip
            pages={pages!}
            activePageId={activePageId}
            onSelect={setActivePageId}
            onAdd={() => addPage(null)}
          />
        )}

        <div
          ref={setCardDroppableRef}
          className={cn(
            'bg-card relative w-full rounded-xl transition-colors duration-150',
            isPageMode ? 'border-transparent' : 'border shadow-xl',
            isOverCard && isPaletteDragging && 'ring-primary/30 ring-2 ring-offset-2',
          )}
          data-form-card
        >
          <div className="px-3 pt-8 pb-6">
            <FormHeader key={schema.id} />
          </div>

          <div
            key={activePage?.id ?? 'page-0'}
            className={cn(
              'animate-in fade-in duration-200 ease-out',
              isMultiPage &&
                (slideDirection === 1 ? 'slide-in-from-right-8' : 'slide-in-from-left-8'),
            )}
          >
            {activePage && (
              <PageTitleEditor
                page={activePage}
                pageIndex={pages!.indexOf(activePage)}
                canRemove={pages!.length > 1}
              />
            )}

            <div className="flex flex-col px-3">
            {fieldsInView.length === 0 && !isMultiPage ? (
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
            ) : fieldsInView.length === 0 ? (
              <div
                ref={setEndDropRef}
                className={cn(
                  'text-muted-foreground/70 mx-3 flex min-h-24 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-sm transition-colors',
                  isPaletteDragging && 'border-primary/60 bg-primary/5 text-primary',
                )}
              >
                <p>Empty page — drag a field here or click one in the palette.</p>
              </div>
            ) : (
              <SortableContext
                items={fieldsInView.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <FieldListWithIndicators
                  fields={fieldsInView}
                  flatStartIndex={flatStartIndex}
                  paletteDropIndex={paletteDropIndex}
                  isPaletteDragging={isPaletteDragging}
                  anySelected={anySelected}
                  selectedFieldId={selectedFieldId}
                  renderIndicator={() => <Indicator />}
                />
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
          </div>

          {!isMultiPage && (
            <div className="mt-2 px-6 pb-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addPage(null)}
                className="text-muted-foreground hover:text-foreground -ml-2"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add page break
              </Button>
            </div>
          )}

          <div className="px-3 pb-6">
            <div
              className={cn(
                'transition-[filter,opacity] duration-200',
                anySelected && !isSubmitSelected && 'opacity-60 blur-[1.5px]',
              )}
            >
              {isLastPage ? (
                <SubmitButtonBlock />
              ) : (
                <NavigationButtonsBlock isFirstPage={isFirstPage} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PageStripProps {
  pages: FormPage[];
  activePageId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

function PageStrip({ pages, activePageId, onSelect, onAdd }: PageStripProps) {
  return (
    <div
      className={cn(
        'absolute top-0 -left-12 flex flex-col items-center gap-1.5',
        'rounded-lg border bg-card/80 supports-backdrop-filter:bg-card/50 p-1.5 shadow-sm backdrop-blur',
      )}
      data-page-strip
    >
      {pages.map((page, i) => {
        const isActive = page.id === activePageId;
        const label = page.title?.trim() || `Page ${i + 1}`;
        return (
          <button
            key={page.id}
            type="button"
            onClick={() => onSelect(page.id)}
            title={label}
            aria-label={`Switch to ${label}`}
            aria-pressed={isActive}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {i + 1}
          </button>
        );
      })}
      <div className="bg-border my-0.5 h-px w-6" />
      <button
        type="button"
        onClick={onAdd}
        title="Add page"
        aria-label="Add page"
        className="text-muted-foreground hover:text-foreground hover:bg-accent flex h-8 w-8 items-center justify-center rounded-md transition-colors"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

interface PageTitleEditorProps {
  page: FormPage;
  pageIndex: number;
  canRemove: boolean;
}

function PageTitleEditor({ page, pageIndex, canRemove }: PageTitleEditorProps) {
  const renamePage = useFormBuilderStore((s) => s.renamePage);
  const removePage = useFormBuilderStore((s) => s.removePage);
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => renamePage(page.id, e.target.value),
    [page.id, renamePage],
  );
  return (
    <div className="flex items-center gap-1 px-6 pb-3">
      <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        Page {pageIndex + 1}
      </span>
      <Input
        value={page.title ?? ''}
        onChange={handleChange}
        placeholder={`Page ${pageIndex + 1} title (optional)`}
        className="h-7 flex-1 border-transparent bg-transparent text-sm font-medium shadow-none focus-visible:bg-background focus-visible:border-border"
      />
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive h-6 w-6"
          onClick={() => removePage(page.id)}
          aria-label="Delete page"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

interface FieldListProps {
  fields: FormField[];
  /** Offset added to each field's local index to compute the global flat index
   * — keeps drop-indicator alignment consistent with `paletteDropIndex`. */
  flatStartIndex: number;
  paletteDropIndex: number | null;
  isPaletteDragging: boolean;
  anySelected: boolean;
  selectedFieldId: string | null;
  renderIndicator: () => ReactNode;
}

function FieldListWithIndicators({
  fields,
  flatStartIndex,
  paletteDropIndex,
  isPaletteDragging,
  anySelected,
  selectedFieldId,
  renderIndicator,
}: FieldListProps) {
  return (
    <div className="flex flex-col">
      {fields.map((field, localIdx) => {
        const flatIdx = flatStartIndex + localIdx;
        const showIndicatorAbove = isPaletteDragging && paletteDropIndex === flatIdx;
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
              <FieldBlock field={field} index={flatIdx} />
            </div>
          </div>
        );
      })}
      {isPaletteDragging && paletteDropIndex === flatStartIndex + fields.length && renderIndicator()}
    </div>
  );
}
