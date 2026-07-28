'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { Form } from '../../sui/gen/walform/form';
import { FormReviewers } from '../../sui/gen/walform/reviewers';
import { getMoveObjects } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import { useActiveNetwork, useReviewersEventPackageId } from '../../sui/env-network';
import { collectEventsGql } from '../../sui/graphql/events';

/** Payload of `reviewers::ReviewerAdded` (GraphQL `contents.json`). */
interface ReviewerAddedEvent {
  form_id?: string;
  reviewers_id?: string;
  member?: string;
}

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
  // The `reviewers` module's TYPE-ORIGIN package id — where its events are
  // tagged. NOT originalPackageId: on testnet `reviewers` was added in an
  // upgrade, so its `ReviewerAdded` events live under that upgrade's id, and
  // querying the original id silently returns zero (empty "Reviewing" list).
  // See `useReviewersEventPackageId`.
  const reviewersPkg = useReviewersEventPackageId();
  const activeNetwork = useActiveNetwork();
  const client = useSuiGrpcClient();
  const me = account?.address ? normalizeSuiAddress(account.address) : null;

  // Full paginated scan. The old `limit: 200` single call was silently capped
  // at 50 by the RPC, so a reviewer added earlier than the 50 most recent adds
  // never saw their form in "Reviewing".
  const eventsQuery = useQuery<ReviewerAddedEvent[]>({
    queryKey: [activeNetwork, 'walform:reviewer-added-events', reviewersPkg],
    enabled: !!reviewersPkg && !!me && !!activeNetwork,
    staleTime: 10_000,
    queryFn: async () => {
      if (!reviewersPkg || !activeNetwork) return [];
      return collectEventsGql<ReviewerAddedEvent>({
        network: activeNetwork,
        eventType: `${reviewersPkg}::reviewers::ReviewerAdded`,
        order: 'descending',
      });
    },
  });

  // Build candidate (formId → reviewersId) map from events where member == me.
  const candidates = useMemo(() => {
    const map = new Map<string, string>(); // formId → reviewersId
    if (!me) return map;
    for (const parsed of eventsQuery.data ?? []) {
      if (!parsed?.form_id || !parsed.reviewers_id || !parsed.member) continue;
      if (normalizeSuiAddress(parsed.member) !== me) continue;
      const fid = normalizeSuiAddress(parsed.form_id);
      if (map.has(fid)) continue;
      map.set(fid, parsed.reviewers_id);
    }
    return map;
  }, [eventsQuery.data, me]);

  // Two batches rather than one mixed read: BCS decoding needs the Move layout
  // up front, so Forms and FormReviewers can't share a request the way an
  // untyped `multiGetObjects` could.
  const formIds = useMemo(() => [...candidates.keys()], [candidates]);
  const reviewersIds = useMemo(() => [...candidates.values()], [candidates]);

  const objectsQuery = useQuery({
    queryKey: [activeNetwork, 'walform:reviewing-objects', formIds, reviewersIds],
    enabled: formIds.length > 0,
    queryFn: async ({ signal }) => {
      const [forms, trackers] = await Promise.all([
        getMoveObjects(client, Form, formIds, signal),
        getMoveObjects(client, FormReviewers, reviewersIds, signal),
      ]);
      return { forms, trackers };
    },
  });

  const reviewing = useMemo<ReviewingForm[]>(() => {
    if (!me) return [];
    const formInfoById = new Map<string, FormInfo>();
    const membersByFormId = new Map<string, string[]>();

    for (const obj of objectsQuery.data?.forms ?? []) {
      formInfoById.set(normalizeSuiAddress(obj.objectId), toFormInfo(obj.fields));
    }
    for (const obj of objectsQuery.data?.trackers ?? []) {
      membersByFormId.set(
        normalizeSuiAddress(obj.fields.form_id),
        obj.fields.members.contents.map((m) => normalizeSuiAddress(m)),
      );
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
    (!!reviewersPkg && !!me && eventsQuery.isPending) ||
    (formIds.length > 0 && objectsQuery.isPending);
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

function toFormInfo(f: ReturnType<typeof Form.parse>): FormInfo {
  // Best-effort cover URL parse from schema JSON (same heuristic as
  // useOnChainForms — non-fatal if it fails, e.g. a sealed schema).
  let cover: string | null = null;
  if (f.schema.length > 0) {
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
    title: f.title || 'Untitled form',
    owner: normalizeSuiAddress(f.owner),
    closed: f.closed,
    closesAtMs: Number(f.settings.closes_at_ms),
    maxSubmissions: Number(f.settings.max_submissions),
    submissionCount: Number(f.stats.submission_count),
    accessMode: Number(f.settings.access_mode),
    coverImage: cover,
  };
}
