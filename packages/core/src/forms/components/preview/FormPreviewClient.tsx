'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useMemo } from 'react';
import { WalformMark } from '../../../ui/landing-pages/walform-mark';
import { cn } from '../../../lib/utils';
import { useStoredForm } from '../../hooks/use-stored-form';
import { useFormBuilderStore } from '../../store/form-builder-store';
import { buildFormAreaStyle } from '../../lib/form-appearance';
import { getFormFont } from '../../lib/form-fonts';
import { CoverImageView } from '../editor/CoverImage';
import { FormPreview } from './FormPreview';

interface Props {
  id: string;
}

export function FormPreviewClient({ id }: Props) {
  const state = useStoredForm(id);
  const schema = useFormBuilderStore((s) => s.schema);

  const formAreaStyle = useMemo(() => {
    const formFont = getFormFont(schema.settings.fontFamily);
    return buildFormAreaStyle(
      formFont.fontFamily,
      schema.settings.borderRadius ?? 4,
      schema.settings.primaryColor ?? 'default',
    );
  }, [schema.settings.fontFamily, schema.settings.borderRadius, schema.settings.primaryColor]);

  const isPageMode = (schema.settings.displayMode ?? 'card') === 'page';

  if (state.status === 'not-found') notFound();

  if (state.status === 'loading') {
    return <div className="bg-secondary/40 min-h-screen animate-pulse" />;
  }

  if (state.status === 'unsupported-version') {
    return (
      <div className="bg-secondary/40 flex min-h-screen items-center justify-center px-6">
        <div className="bg-card w-full max-w-md rounded-xl border p-6 text-center shadow-lg">
          <p className="text-base font-semibold">This form is from a newer version</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Update the app to preview this draft (schema v{state.foundVersion}).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-screen flex-col items-center px-4 py-10 sm:py-16',
        isPageMode ? 'bg-card' : 'bg-secondary/40',
      )}
    >
      <div className="flex w-full max-w-4xl flex-col items-center" style={formAreaStyle}>
        {schema.coverImage && (
          <div className="mb-4 w-full">
            <CoverImageView src={schema.coverImage} />
          </div>
        )}

        {/* Form surface — card mode gets the chrome, page mode blends with the bg. */}
        <div
          className={cn(
            'w-full max-w-2xl rounded-xl',
            isPageMode ? 'bg-transparent' : 'bg-card border shadow-xl',
          )}
        >
          <FormPreview schema={schema} />
        </div>

        {/* Attribution footer, right under the card */}
        <footer className="text-muted-foreground mt-4 flex w-full max-w-2xl flex-col items-center gap-1 px-2 text-center text-xs sm:flex-row sm:justify-between sm:text-left">
          <Link
            href="/"
            className="hover:text-foreground inline-flex items-center gap-2 transition-colors"
          >
            <WalformMark className="size-4" />
            <span className="font-medium">
              Made with <span className="underline-offset-2 group-hover:underline">WalForm</span>
            </span>
          </Link>
          <span className="text-muted-foreground/70">Decentralized forms on Sui &amp; Walrus</span>
        </footer>
      </div>
    </div>
  );
}
