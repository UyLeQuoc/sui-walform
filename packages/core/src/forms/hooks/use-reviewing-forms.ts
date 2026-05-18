'use client';

import { useMemo } from 'react';
import { useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { useOriginalPackageId } from '../../sui/package-id';

export interface ReviewingForm {
  formId: string;
  title: string;
  owner: string;
  closed: boolean;
  closesAtMs: number;
  maxSubmissions: number;
  submissionCount: number;
  accessMode: number;
  coverImage: string | null;
  /** The shared FormReviewers objectId that includes the current address. */
  reviewersId: string;
}

export interface UseReviewingFormsResult {
  reviewing: ReviewingForm[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Forms where the connected wallet appears in a `FormReviewers.members` set.
 * Discovery walks the `ReviewerAdded` event stream (filtered to the caller)
 * then verifies each match against the current FormReviewers state — so
 * removals are honored without us needing to track ReviewerRemoved separately.
 *
 * Stop-gap pattern; same scaling caveat as `useTemplateListing` (event limit
 * 200, paginate when needed).
 */
export function useReviewingForms(): UseReviewingFormsResult {
  const account = useCurrentAccount();
  // Move event types are canonicalised to the package's original publish id,
  // regardless of when the module was added via upgrade. Using active here
  // would silently return zero events after every `contracts:upgrade`.
  const originalPackageId = useOriginalPackageId();
  const me = account?.address ? normalizeSuiAddress(account.address) : null;

  const eventsQuery = useSuiClientQuery(
    'queryEvents',
    {
      query: originalPackageId
        ? { MoveEventType: `${originalPackageId}::reviewers::ReviewerAdded` }
        : ({} as never),
      order: 'descending',
      limit: 200,
    },
    { enabled: !!originalPackageId && !!me },
  );

  // Build candidate (formId → reviewersId) map from events where member == me.
  const candidates = useMemo(() => {
    const map = new Map<string, string>(); // formId → reviewersId
    if (!me) return map;
    for (const ev of eventsQuery.data?.data ?? []) {
      const parsed = ev.parsedJson as
        | { form_id?: string; reviewers_id?: string; member?: string }
        | undefined;
      if (!parsed?.form_id || !parsed.reviewers_id || !parsed.member) continue;
      if (normalizeSuiAddress(parsed.member) !== me) continue;
      const fid = normalizeSuiAddress(parsed.form_id);
      if (map.has(fid)) continue;
      map.set(fid, parsed.reviewers_id);
    }
    return map;
  }, [eventsQuery.data, me]);

  // Fetch both Form objects + FormReviewers objects in a single batch.
  const objectIds = useMemo(() => {
    const out: string[] = [];
    for (const [formId, reviewersId] of candidates) {
      out.push(formId);
      out.push(reviewersId);
    }
    return out;
  }, [candidates]);

  const objectsQuery = useSuiClientQuery(
    'multiGetObjects',
    {
      ids: objectIds,
      options: { showContent: true, showType: true },
    },
    { enabled: objectIds.length > 0 },
  );

  const reviewing = useMemo<ReviewingForm[]>(() => {
    if (!me) return [];
    const objects = objectsQuery.data ?? [];
    const formInfoById = new Map<string, FormInfo>();
    const membersByFormId = new Map<string, string[]>();

    for (const entry of objects) {
      const obj = entry.data;
      if (!obj?.objectId) continue;
      const type = obj.type ?? '';
      if (type.endsWith('::form::Form')) {
        const info = parseFormInfo(obj);
        if (info) formInfoById.set(normalizeSuiAddress(obj.objectId), info);
      } else if (type.endsWith('::reviewers::FormReviewers')) {
        const r = parseReviewersInfo(obj);
        if (r) membersByFormId.set(r.formId, r.members);
      }
    }

    const out: ReviewingForm[] = [];
    for (const [formId, reviewersId] of candidates) {
      const members = membersByFormId.get(formId);
      if (!members || !members.includes(me)) continue; // dropped via remove_reviewer
      const info = formInfoById.get(formId);
      if (!info) continue;
      out.push({
        formId,
        reviewersId,
        title: info.title,
        owner: info.owner,
        closed: info.closed,
        closesAtMs: info.closesAtMs,
        maxSubmissions: info.maxSubmissions,
        submissionCount: info.submissionCount,
        accessMode: info.accessMode,
        coverImage: info.coverImage,
      });
    }
    return out;
  }, [candidates, me, objectsQuery.data]);

  const isLoading =
    (!!originalPackageId && !!me && eventsQuery.isPending) ||
    (objectIds.length > 0 && objectsQuery.isPending);
  const error = (eventsQuery.error as Error | null) ?? (objectsQuery.error as Error | null) ?? null;

  return { reviewing, isLoading, error };
}

interface FormInfo {
  title: string;
  owner: string;
  closed: boolean;
  closesAtMs: number;
  maxSubmissions: number;
  submissionCount: number;
  accessMode: number;
  coverImage: string | null;
}

function parseFormInfo(obj: { content?: unknown }): FormInfo | null {
  const content = obj.content as
    | {
        dataType: 'moveObject';
        fields: {
          title?: string;
          owner?: string;
          closed?: boolean;
          settings?: {
            fields?: {
              access_mode?: number | string;
              closes_at_ms?: string | number;
              max_submissions?: string | number;
            };
          };
          stats?: { fields?: { submission_count?: string | number } };
          schema?: number[];
        };
      }
    | undefined;
  if (!content?.fields) return null;
  const f = content.fields;
  const settings = f.settings?.fields ?? {};
  const stats = f.stats?.fields ?? {};
  // Best-effort cover URL parse from schema JSON (same heuristic as
  // useOnChainForms — non-fatal if it fails).
  let cover: string | null = null;
  if (Array.isArray(f.schema) && f.schema.length > 0) {
    try {
      const json = JSON.parse(new TextDecoder().decode(new Uint8Array(f.schema))) as {
        coverImage?: string;
      };
      cover = typeof json.coverImage === 'string' ? json.coverImage : null;
    } catch {
      cover = null;
    }
  }
  return {
    title: f.title ?? 'Untitled form',
    owner: f.owner ? normalizeSuiAddress(f.owner) : '',
    closed: Boolean(f.closed),
    closesAtMs: Number(settings.closes_at_ms ?? 0),
    maxSubmissions: Number(settings.max_submissions ?? 0),
    submissionCount: Number(stats.submission_count ?? 0),
    accessMode: Number(settings.access_mode ?? 0),
    coverImage: cover,
  };
}

function parseReviewersInfo(obj: {
  content?: unknown;
}): { formId: string; members: string[] } | null {
  const content = obj.content as
    | {
        dataType: 'moveObject';
        fields: {
          form_id?: string;
          members?: { fields?: { contents?: string[] } } | string[];
        };
      }
    | undefined;
  if (!content?.fields) return null;
  const formId = content.fields.form_id ? normalizeSuiAddress(content.fields.form_id) : null;
  if (!formId) return null;
  const rawContents = Array.isArray(content.fields.members)
    ? content.fields.members
    : (content.fields.members?.fields?.contents ?? []);
  const members = rawContents.map((m) => normalizeSuiAddress(m));
  return { formId, members };
}
