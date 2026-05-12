'use client';

import { useEffect } from 'react';

const SUFFIX = 'Form Builder';

/**
 * Set `document.title` while this component is mounted, restoring the
 * previous title on unmount. Falsy/empty input falls back to the suffix
 * alone so the tab never reads "·  · Form Builder".
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    const previous = document.title;
    const trimmed = (title ?? '').trim();
    document.title = trimmed ? `${trimmed} · ${SUFFIX}` : SUFFIX;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
