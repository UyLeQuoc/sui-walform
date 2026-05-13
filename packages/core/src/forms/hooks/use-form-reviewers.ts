'use client';

import { useState } from 'react';
import { useSuiClientQuery } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { toast } from 'sonner';
import { useActivePackageId } from '../../sui/package-id';
import {
  buildAddReviewerTx,
  buildInitReviewersTx,
  buildRemoveReviewerTx,
} from '../../sui/tx/reviewers';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';

export interface FormReviewersState {
  /** Shared FormReviewers objectId; null if the form was published pre-reviewer-upgrade. */
  reviewersId: string | null;
  /** Normalized member addresses. */
  members: string[];
  /** Form owner address (cached from the tracker). */
  owner: string | null;
  isLoading: boolean;
  error: Error | null;
}

export interface UseFormReviewersResult extends FormReviewersState {
  /** Add a new reviewer. Caller must be owner or existing reviewer. */
  addReviewer: (address: string) => Promise<void>;
  /** Remove. Owner-only — requires the cap id. */
  removeReviewer: (address: string, capId: string) => Promise<void>;
  /**
   * Create the `FormReviewers` tracker for a form published before the
   * reviewers upgrade. Owner-only — requires the cap id + form id. After
   * success, the next render picks up the new tracker via the event query.
   */
  enableReviewers: (formId: string, capId: string) => Promise<void>;
  isMutating: boolean;
}

/**
 * Resolve + manage a form's `FormReviewers` shared object. Discovery follows
 * the same event-scan pattern as `useTemplateListing` / `useFormTreasury`:
 * query recent `ReviewersCreated` events and pick the earliest match for
 * this form_id.
 */
export function useFormReviewers(formId: string | undefined): UseFormReviewersResult {
  const packageId = useActivePackageId();
  const { execute } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const [isMutating, setIsMutating] = useState(false);

  // Reviewer events are namespaced under the upgrade packageId where the
  // `reviewers` module was first introduced — NOT `originalPackageId`.
  // Until we persist module-type-origin metadata, use active packageId
  // (which after a non-module-adding upgrade keeps pointing at the
  // introducing version's bytecode).
  const eventsQuery = useSuiClientQuery(
    'queryEvents',
    {
      query: packageId
        ? { MoveEventType: `${packageId}::reviewers::ReviewersCreated` }
        : ({} as never),
      order: 'ascending',
      limit: 200,
    },
    { enabled: !!packageId && !!formId },
  );

  // Find the earliest event for this form_id.
  let reviewersId: string | null = null;
  if (formId) {
    const target = normalizeSuiAddress(formId);
    const events = eventsQuery.data?.data ?? [];
    for (const ev of events) {
      const parsed = ev.parsedJson as { form_id?: string; reviewers_id?: string } | undefined;
      if (!parsed?.form_id || !parsed.reviewers_id) continue;
      if (normalizeSuiAddress(parsed.form_id) !== target) continue;
      reviewersId = parsed.reviewers_id;
      break;
    }
  }

  const objectQuery = useSuiClientQuery(
    'getObject',
    {
      id: reviewersId ?? '',
      options: { showContent: true, showType: true },
    },
    { enabled: !!reviewersId },
  );

  const { members, owner } = parseReviewers(objectQuery.data);

  const addReviewer = async (address: string) => {
    if (!packageId || !reviewersId) {
      toast.error('Reviewers tracker not available for this form yet.');
      return;
    }
    const trimmed = address.trim();
    if (!trimmed) {
      toast.error('Enter a Sui address.');
      return;
    }
    setIsMutating(true);
    try {
      const tx = buildAddReviewerTx({ packageId, reviewersId, newMember: trimmed });
      const { digest } = await execute({ transaction: tx });
      await invalidateChain(digest);
      toast.success('Reviewer added.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Add failed: ${msg}`);
    } finally {
      setIsMutating(false);
    }
  };

  const enableReviewers = async (formObjectId: string, capId: string) => {
    if (!packageId) {
      toast.error('walform package not configured for this network.');
      return;
    }
    setIsMutating(true);
    try {
      const tx = buildInitReviewersTx({
        packageId,
        formObjectId,
        formOwnerCapId: capId,
      });
      const { digest } = await execute({ transaction: tx });
      await invalidateChain(digest);
      toast.success('Reviewers enabled.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Enable failed: ${msg}`);
    } finally {
      setIsMutating(false);
    }
  };

  const removeReviewer = async (address: string, capId: string) => {
    if (!packageId || !reviewersId) {
      toast.error('Reviewers tracker not available for this form yet.');
      return;
    }
    setIsMutating(true);
    try {
      const tx = buildRemoveReviewerTx({
        packageId,
        reviewersId,
        formOwnerCapId: capId,
        member: address,
      });
      const { digest } = await execute({ transaction: tx });
      await invalidateChain(digest);
      toast.success('Reviewer removed.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Remove failed: ${msg}`);
    } finally {
      setIsMutating(false);
    }
  };

  const isLoading =
    (!!packageId && !!formId && eventsQuery.isPending) || (!!reviewersId && objectQuery.isPending);

  return {
    reviewersId,
    members,
    owner,
    isLoading,
    error: (eventsQuery.error as Error | null) ?? (objectQuery.error as Error | null) ?? null,
    addReviewer,
    removeReviewer,
    enableReviewers,
    isMutating,
  };
}

type GetObjectData = ReturnType<typeof useSuiClientQuery<'getObject'>>['data'];

function parseReviewers(data: GetObjectData): { members: string[]; owner: string | null } {
  const obj = data?.data;
  if (!obj) return { members: [], owner: null };
  const content = obj.content as unknown as
    | {
        dataType: 'moveObject';
        fields: {
          owner?: string;
          members?: { fields?: { contents?: string[] } } | string[];
        };
      }
    | undefined;
  const fields = content?.fields;
  if (!fields) return { members: [], owner: null };
  const owner = fields.owner ? normalizeSuiAddress(fields.owner) : null;
  // VecSet<address> serializes as { contents: address[] } via Sui RPC.
  const rawContents = Array.isArray(fields.members)
    ? fields.members
    : (fields.members?.fields?.contents ?? []);
  const members = rawContents.map((m) => normalizeSuiAddress(m));
  return { members, owner };
}
