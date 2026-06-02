'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Spinner } from '../../../ui/spinner';
import { cn } from '../../../lib/utils';
import { useFormPreview } from '../../hooks/use-form-preview';
import { FormAppearanceProvider } from '../../lib/form-appearance-context';
import type { FormSchema } from '../../../types';
import type { FieldValues } from 'react-hook-form';
import { isInputField } from '../../lib/field-types';
import { PreviewFieldRenderer } from './PreviewFieldRenderer';
import { QuestionNumberProvider } from './PreviewField';

export interface FormPreviewProps {
  /** The form schema to render. Builder pulls this from its Zustand store;
   *  renderer (future) pulls from an on-chain Sui object. Passed as a prop
   *  so this component stays context-agnostic. */
  schema: FormSchema;
  /** Optional submit handler. If omitted, we only toast the success message
   *  and log payload (builder-preview behaviour). */
  onSubmit?: (values: FieldValues) => void | Promise<void>;
  /** Initial field values (e.g. from a Walrus-Site `#prefill=…` handoff).
   *  Merged on top of the schema-derived defaults — applied once at mount. */
  prefill?: Record<string, unknown>;
  /** External submission-in-flight flag (encrypting, wallet signing,
   *  broadcasting). When true the whole form is disabled — RHF's own
   *  `formState.isSubmitting` only covers the duration of the `onSubmit`
   *  callback, but wallet flows can have surrounding async work too. */
  isSubmitting?: boolean;
  /** Read-only browse mode (Marketplace template preview): fields are
   *  non-interactive, page navigation works without validation, and the final
   *  submit is hidden. */
  preview?: boolean;
}

export function FormPreview({
  schema,
  onSubmit,
  prefill,
  isSubmitting,
  preview,
}: FormPreviewProps) {
  const {
    form,
    handleSubmit,
    pages,
    currentPageIndex,
    isFirstPage,
    isLastPage,
    progress,
    navigation,
    goNext,
    goPrevious,
    pageError,
  } = useFormPreview({ schema, onSubmit, prefill, preview });

  // Slide direction: 1 = went forward (Next), -1 = went back (Previous).
  // Used to flip the page-content animation between slide-in-from-right
  // and slide-in-from-left so motion matches the navigation intent.
  // Declared before the early-return so hook order stays stable across renders.
  const prevIndexRef = useRef(currentPageIndex);
  const [direction, setDirection] = useState<1 | -1>(1);
  useEffect(() => {
    if (currentPageIndex !== prevIndexRef.current) {
      setDirection(currentPageIndex > prevIndexRef.current ? 1 : -1);
      prevIndexRef.current = currentPageIndex;
    }
  }, [currentPageIndex]);

  if (schema.fields.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-muted-foreground text-sm">
          No fields to preview. Switch to Edit to add fields.
        </p>
      </div>
    );
  }

  const currentPage = pages[currentPageIndex];
  const isMultiPage = pages.length > 1;
  const currentFields = (currentPage?.fieldIds ?? [])
    .map((id) => schema.fields.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  const alignment = schema.settings.submitAlignment;
  const submitLabel = schema.settings.submitLabel;
  const nextLabel = schema.settings.nextLabel?.trim() || 'Next';
  const previousLabel = schema.settings.previousLabel?.trim() || 'Previous';
  // When alignment is `center`, the button row stretches edge to edge and
  // each button takes `flex-1` (matches the single-page Submit `w-full`
  // behavior). `left` / `right` keep natural width and hug the chosen edge.
  const isCenter = alignment === 'center';
  const rowAlignClass = cn(
    'flex items-center gap-2 px-6 pb-8 pt-4',
    alignment === 'right' && 'justify-end',
    alignment === 'left' && 'justify-start',
    isCenter && 'justify-stretch',
  );
  const buttonWidthClass = isCenter ? 'flex-1' : '';

  return (
    <FormAppearanceProvider borderRadiusIndex={schema.settings.borderRadius}>
      <div>
        <div className="px-6 pt-8 pb-6">
          {schema.title && <h1 className="text-3xl leading-tight font-bold">{schema.title}</h1>}
          {schema.description && (
            <p className="text-muted-foreground mt-2 text-sm">{schema.description}</p>
          )}
        </div>

        {isMultiPage && navigation.showProgress && (
          <div className="px-6 pb-3">
            <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-[width] duration-200"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Page {currentPageIndex + 1} of {pages.length}
              {currentPage?.title ? ` · ${currentPage.title}` : ''}
            </p>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isLastPage) {
              void handleSubmit(e);
            } else {
              void goNext();
            }
          }}
        >
          {/* `<fieldset disabled>` natively disables every nested form control
              (inputs, buttons, RadixUI radios/checkboxes, custom <button>s),
              which is what we want while the wallet is signing. `contents`
              keeps the existing flex/padding layout undisturbed. The
              `group/fieldset` lets option wrappers respond visually. */}
          <fieldset
            disabled={form.formState.isSubmitting || isSubmitting}
            className="group/fieldset contents"
          >
            <div
              key={currentPage?.id ?? 'page-0'}
              className={cn(
                'animate-in fade-in duration-200 ease-out',
                isMultiPage &&
                  (direction === 1 ? 'slide-in-from-right-8' : 'slide-in-from-left-8'),
                'group-disabled/fieldset:opacity-70',
                preview && 'pointer-events-none select-none',
              )}
            >
              {isMultiPage && currentPage && (currentPage.title || currentPage.description) && (
                <div className="px-6 pb-2">
                  {currentPage.title && (
                    <h2 className="text-lg font-semibold">{currentPage.title}</h2>
                  )}
                  {currentPage.description && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      {currentPage.description}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col px-3">
                {(() => {
                  // Question numbering for preview + Mode A renderer — only
                  // input fields are counted, layout blocks (heading,
                  // description, markdown, divider, space) pass null so they
                  // render without a number. Numbers reset per page so a
                  // multi-page form starts each page at 1.
                  let questionCounter = 0;
                  return currentFields.map((field) => {
                    const questionNumber = isInputField(field) ? ++questionCounter : null;
                    return (
                      <QuestionNumberProvider key={field.id} value={questionNumber}>
                        <PreviewFieldRenderer field={field} control={form.control} />
                      </QuestionNumberProvider>
                    );
                  });
                })()}
              </div>
            </div>

            {pageError && (
              <div className="px-6 pt-2">
                <p className="text-destructive text-xs">{pageError}</p>
              </div>
            )}

            <div className={rowAlignClass}>
              {isMultiPage && (preview || navigation.allowBack) && !isFirstPage && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goPrevious}
                  className={buttonWidthClass}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {previousLabel}
                </Button>
              )}
              {isMultiPage && !isLastPage ? (
                <Button
                  type={preview ? 'button' : 'submit'}
                  onClick={preview ? () => void goNext() : undefined}
                  className={buttonWidthClass}
                >
                  {nextLabel}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : preview ? null : (
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || isSubmitting}
                  className={cn(buttonWidthClass, !isMultiPage && isCenter && 'w-full')}
                >
                  {(form.formState.isSubmitting || isSubmitting) && (
                    <Spinner className="mr-1.5 size-3.5" />
                  )}
                  {submitLabel}
                </Button>
              )}
            </div>
          </fieldset>
        </form>
      </div>
    </FormAppearanceProvider>
  );
}
