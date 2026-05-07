'use client';

import { useCallback, useState } from 'react';
import { isDataUrl } from '../../walrus';
import { formDb } from '../services/form-db';

export interface UseDraftCoverDataUrlResult {
  /** Set when the draft has a `data:` cover image — undefined when no cover or already on Walrus. */
  coverDataUrl: string | undefined;
  /** Re-read from IDB. Call before opening the publish dialog so the cost estimate is fresh. */
  refresh: () => Promise<void>;
}

/**
 * Loads the draft's cover image as a `data:` URL so the publish dialog can
 * decode it once + show a Walrus storage-cost estimate up-front. Returns
 * undefined if the cover is already on Walrus (URL, not data:) or absent.
 */
export function useDraftCoverDataUrl(formId: string): UseDraftCoverDataUrlResult {
  const [coverDataUrl, setCoverDataUrl] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const stored = await formDb.getById(formId);
      const cover = stored?.schema.coverImage;
      setCoverDataUrl(isDataUrl(cover) ? cover : undefined);
    } catch {
      setCoverDataUrl(undefined);
    }
  }, [formId]);

  return { coverDataUrl, refresh };
}
