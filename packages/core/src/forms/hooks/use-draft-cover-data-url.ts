'use client';

import { useCallback, useState } from 'react';
import { isDataUrl } from '../../walrus';
import { formDb } from '../services/form-db';

export interface UseDraftCoverDataUrlResult {
  /** Set when the draft has a `data:` cover image — undefined when no cover or already on Walrus. */
  coverDataUrl: string | undefined;
  /** Draft description from the schema (empty string when absent). */
  description: string;
  /** AI-suggested tags from the schema (empty when absent). */
  tags: string[];
  /** Re-read from IDB. Call before opening the publish dialog so cost + meta are fresh. */
  refresh: () => Promise<void>;
}

/**
 * Loads the draft's publish-time context (cover data URL for the Walrus
 * storage estimate + description / tags to seed the marketplace tab). Returns
 * `coverDataUrl` undefined when the cover is already on Walrus (URL, not
 * data:) or absent.
 */
export function useDraftCoverDataUrl(formId: string): UseDraftCoverDataUrlResult {
  const [coverDataUrl, setCoverDataUrl] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const stored = await formDb.getById(formId);
      const cover = stored?.schema.coverImage;
      setCoverDataUrl(isDataUrl(cover) ? cover : undefined);
      setDescription(stored?.schema.description ?? '');
      setTags(stored?.schema.tags ?? []);
    } catch {
      setCoverDataUrl(undefined);
      setDescription('');
      setTags([]);
    }
  }, [formId]);

  return { coverDataUrl, description, tags, refresh };
}
