'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_PRIORITY,
  DEFAULT_STATUS,
  submissionTagsDb,
  type SubmissionPriority,
  type SubmissionStatus,
  type SubmissionTag,
} from '../services/submission-tags-db';

export interface UseSubmissionTagsResult {
  /** Map keyed by submissionId. Missing entries → default status/priority. */
  tags: Record<string, SubmissionTag>;
  isLoading: boolean;
  /** Resolve a tag for any submission — synthesizes defaults if no record. */
  tagFor: (submissionId: string) => SubmissionTag;
  setStatus: (submissionId: string, status: SubmissionStatus) => Promise<void>;
  setPriority: (submissionId: string, priority: SubmissionPriority) => Promise<void>;
}

const QUERY_KEY_PREFIX = 'walform-submission-tags';

/**
 * Creator-local triage state for a form's submissions. Persisted in IDB so
 * the same browser remembers status + priority decisions across reloads.
 * Not synced across devices — intentionally a creator-private workflow tool
 * that doesn't add Sui or Walrus footprint per submission.
 */
export function useSubmissionTags(formId: string | undefined): UseSubmissionTagsResult {
  const queryClient = useQueryClient();
  const queryKey = [QUERY_KEY_PREFIX, formId];

  const query = useQuery({
    queryKey,
    enabled: !!formId,
    queryFn: async () => {
      if (!formId) return {};
      const records = await submissionTagsDb.listByForm(formId);
      const next: Record<string, SubmissionTag> = {};
      for (const r of records) next[r.submissionId] = r;
      return next;
    },
  });

  // Re-fetch on cross-tab / cross-component IDB mutations.
  useEffect(() => {
    if (!formId) return;
    const onChange = () => {
      void queryClient.invalidateQueries({ queryKey });
    };
    window.addEventListener(submissionTagsDb.changeEvent, onChange);
    return () => window.removeEventListener(submissionTagsDb.changeEvent, onChange);
    // queryKey is a fresh array each render but its identity for the listener
    // doesn't matter — we recompute it inside the closure on every fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, queryClient]);

  const tags = useMemo(() => query.data ?? {}, [query.data]);

  const tagFor = useCallback(
    (submissionId: string): SubmissionTag => {
      const found = tags[submissionId];
      if (found) return found;
      return {
        key: `${formId ?? ''}:${submissionId}`,
        formId: formId ?? '',
        submissionId,
        status: DEFAULT_STATUS,
        priority: DEFAULT_PRIORITY,
        updatedAt: 0,
      };
    },
    [tags, formId],
  );

  const setStatus = useCallback(
    async (submissionId: string, status: SubmissionStatus) => {
      if (!formId) return;
      await submissionTagsDb.upsert({ formId, submissionId, status });
    },
    [formId],
  );

  const setPriority = useCallback(
    async (submissionId: string, priority: SubmissionPriority) => {
      if (!formId) return;
      await submissionTagsDb.upsert({ formId, submissionId, priority });
    },
    [formId],
  );

  return { tags, isLoading: query.isPending, tagFor, setStatus, setPriority };
}
