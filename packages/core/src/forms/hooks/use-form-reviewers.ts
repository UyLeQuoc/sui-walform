'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import type { SuiGrpcClient } from '@mysten/sui/grpc';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { toast } from 'sonner';
import { FormReviewers } from '../../sui/gen/walform/reviewers';
import { getMoveObject } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import { useActivePackageId } from '../../sui/package-id';
import { useActiveNetwork, useReviewersEventPackageId } from '../../sui/env-network';
import { queryEventsGql, type EventsPage } from '../../sui/graphql/events';
import {
  buildAddReviewerTx,
  buildInitReviewersTx,
  buildRemoveReviewerTx,
} from '../../sui/tx/reviewers';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';

/** Payload of `reviewers::ReviewersCreated` (GraphQL `contents.json`). */
interface ReviewersCreatedEvent {
  form_id?: string;
  reviewers_id?: string;
}

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
  /**
   * Add a new reviewer. Caller must be owner or existing reviewer. Pass
   * `explicitReviewersId` to target a tracker that was JUST created in the
   * same handler (before the event index has caught up) — see `enableReviewers`.
   */
  addReviewer: (address: string, explicitReviewersId?: string) => Promise<void>;
  /** Remove. Owner-only — requires the cap id. */
  removeReviewer: (address: string, capId: string) => Promise<void>;
  /**
   * Create the `FormReviewers` tracker for a form published before the
   * reviewers upgrade. Owner-only — requires the cap id + form id. Returns the
   * NEW tracker's object id (read straight off the tx's objectChanges) so the
   * caller can immediately chain an `addReviewer` without waiting for the
   * event index to surface it. Returns null if the id couldn't be resolved.
   */
  enableReviewers: (formId: string, capId: string) => Promise<string | null>;
  isMutating: boolean;
}

/**
 * Resolve + manage a form's `FormReviewers` shared object. Discovery scans the
 * `ReviewersCreated` event stream (paginated, ascending — earliest match wins)
 * for this form_id. The scan is paginated so a tracker created after the first
 * 50 events anywhere on the package still resolves (the un-paginated version
 * silently lost recently-enabled forms).
 */
export function useFormReviewers(formId: string | undefined): UseFormReviewersResult {
  // Active for MoveCall targets (add / remove / init reviewers PTBs).
  const packageId = useActivePackageId();
  // The `reviewers` module's TYPE-ORIGIN package id — the package id its events
  // are tagged with. NOT originalPackageId: on testnet `reviewers` was added in
  // an upgrade, so its events live under that upgrade's id, not the lineage
  // root. Querying the wrong id silently returns nothing → tracker never
  // resolves → panel stuck on "Tracker initializes" (and every Add spawns a
  // fresh tracker). See `useReviewersEventPackageId`.
  const reviewersPkg = useReviewersEventPackageId();
  const { network } = useSuiClientContext();
  const activeNetwork = useActiveNetwork();
  const client = useSuiGrpcClient();
  const { execute } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const [isMutating, setIsMutating] = useState(false);
  // Tracker id learned straight from a just-run `create_and_share` tx, so the
  // panel reflects it immediately without waiting for the event index (which
  // lags finality by seconds). Scoped to its formId so it can't leak across
  // forms when the hook instance is reused on navigation.
  const [created, setCreated] = useState<{ formId: string; id: string } | null>(null);

  // Paginated event scan → the form's tracker id. Network-prefixed key so
  // `invalidateChain` refreshes it after enable/add/remove.
  const reviewersIdQuery = useQuery<string | null>({
    queryKey: [network, 'walform:reviewers-id', reviewersPkg, formId],
    enabled: !!reviewersPkg && !!formId && !!activeNetwork,
    staleTime: 10_000,
    queryFn: async (): Promise<string | null> => {
      if (!reviewersPkg || !formId || !activeNetwork) return null;
      const target = normalizeSuiAddress(formId);
      let cursor: string | null = null;
      for (let page = 0; page < 100; page++) {
        const res: EventsPage<ReviewersCreatedEvent> = await queryEventsGql<ReviewersCreatedEvent>({
          network: activeNetwork,
          eventType: `${reviewersPkg}::reviewers::ReviewersCreated`,
          order: 'descending',
          limit: 50,
          cursor,
        });
        for (const parsed of res.data) {
          if (!parsed?.form_id || !parsed.reviewers_id) continue;
          if (normalizeSuiAddress(parsed.form_id) !== target) continue;
          // Descending → first match is the NEWEST tracker for this form. Newest
          // matters because the (now-fixed) "panel can't see the tracker" bug
          // could spawn several duplicate trackers per form, and the member was
          // added to the most recent one. Once resolvable, no new dupes appear.
          return parsed.reviewers_id;
        }
        if (!res.hasNextPage || !res.nextCursor) break;
        cursor = res.nextCursor;
      }
      return null;
    },
  });
  // Prefer the indexed id; fall back to the freshly-created one while the event
  // index catches up. Scoped to this formId so a stale value can't bleed over.
  const localId = created && created.formId === formId ? created.id : null;
  const reviewersId = reviewersIdQuery.data ?? localId ?? null;

  const objectQuery = useQuery({
    queryKey: [network, 'walform:reviewers', reviewersId],
    enabled: !!reviewersId,
    queryFn: ({ signal }) => getMoveObject(client, FormReviewers, reviewersId!, signal),
  });

  const tracker = objectQuery.data;
  const owner = tracker ? normalizeSuiAddress(tracker.fields.owner) : null;
  // `members` is a VecSet<address> → `{contents: address[]}` after BCS decode.
  const members = (tracker?.fields.members.contents ?? []).map((m) => normalizeSuiAddress(m));

  const addReviewer = async (address: string, explicitReviewersId?: string) => {
    const targetReviewersId = explicitReviewersId ?? reviewersId;
    if (!packageId || !targetReviewersId) {
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
      const tx = buildAddReviewerTx({ packageId, reviewersId: targetReviewersId, newMember: trimmed });
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

  const enableReviewers = async (
    formObjectId: string,
    capId: string,
  ): Promise<string | null> => {
    if (!packageId) {
      toast.error('walform package not configured for this network.');
      return null;
    }
    setIsMutating(true);
    try {
      const tx = buildInitReviewersTx({
        packageId,
        formObjectId,
        formOwnerCapId: capId,
      });
      const { digest } = await execute({ transaction: tx });
      // Read the freshly created tracker id straight off the tx so the caller
      // can chain `addReviewer` deterministically — no dependency on the event
      // index catching up (which the old useEffect-based chain raced against).
      const newId = await resolveCreatedReviewersId(client, digest);
      // Surface it immediately so the panel renders the tracker without waiting
      // for the event index (and the chained add targets it deterministically).
      if (newId) setCreated({ formId: formObjectId, id: newId });
      await invalidateChain(digest);
      toast.success('Reviewers enabled.');
      return newId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Enable failed: ${msg}`);
      return null;
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
    reviewersIdQuery.isLoading || (!!reviewersId && objectQuery.isPending);

  return {
    reviewersId,
    members,
    owner,
    isLoading,
    error:
      (reviewersIdQuery.error as Error | null) ?? (objectQuery.error as Error | null) ?? null,
    addReviewer,
    removeReviewer,
    enableReviewers,
    isMutating,
  };
}

/**
 * Pull the created `FormReviewers` object id out of a `create_and_share` tx.
 * Waits for the tx to settle, then finds the created object whose type ends in
 * `::reviewers::FormReviewers`. Returns null on any failure — the caller falls
 * back to the event-index lookup.
 *
 * `objectTypes` is the gRPC stand-in for JSON-RPC's `objectChanges`: effects
 * name which objects the tx created, and the map names their types.
 */
async function resolveCreatedReviewersId(
  client: SuiGrpcClient,
  digest: string,
): Promise<string | null> {
  try {
    const res = await client.core.waitForTransaction({
      digest,
      include: { effects: true, objectTypes: true },
    });
    const tx = res.Transaction ?? res.FailedTransaction;
    const types = tx?.objectTypes ?? {};
    for (const changed of tx?.effects?.changedObjects ?? []) {
      if (changed.idOperation !== 'Created') continue;
      if (types[changed.objectId]?.endsWith('::reviewers::FormReviewers')) {
        return normalizeSuiAddress(changed.objectId);
      }
    }
  } catch {
    // Fall through — the event-index refetch will resolve it shortly.
  }
  return null;
}
