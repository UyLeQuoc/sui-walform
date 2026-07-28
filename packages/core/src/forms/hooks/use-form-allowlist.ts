'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { Allowlist } from '../../sui/gen/walform/allowlist';
import { getMoveObject } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import { useOriginalPackageId } from '../../sui/package-id';
import { useActiveNetwork } from '../../sui/env-network';
import { collectEventsGql } from '../../sui/graphql/events';

/** Payload of `events::AllowlistCreated` (GraphQL `contents.json`). */
interface AllowlistCreatedEvent {
  allowlist_id?: string;
  form_id?: string;
  creator?: string;
  created_at_ms?: string | number;
}

export interface FormAllowlist {
  allowlistId: string;
  formId: string;
  creator: string;
  members: string[];
  createdAtMs: number;
}

/**
 * Resolve the per-form Allowlist via the `AllowlistCreated` event stream.
 * Used by `<FormSubmissionView>` to gate Private (ACCESS_ALLOWLIST) submits
 * with a membership check + to feed the allowlist objectId into the
 * `submission::submit` PTB.
 *
 * Returns null when no AllowlistCreated event matches the formId — covers
 * (a) public forms where there's no allowlist concept, and (b) legacy
 * forms published before the publish-PTB started binding an allowlist
 * atomically. Caller falls back to the global throwaway in those cases.
 */
export function useFormAllowlist(formId: string | undefined): {
  allowlist: FormAllowlist | null;
  isLoading: boolean;
  error: Error | null;
} {
  const originalPackageId = useOriginalPackageId();
  const { network } = useSuiClientContext();
  const activeNetwork = useActiveNetwork();
  const client = useSuiGrpcClient();

  // Full paginated scan (descending → newest allowlist per form wins). The old
  // `limit: 200` single call was silently truncated to 50 by the RPC.
  const eventsQuery = useQuery<AllowlistCreatedEvent[]>({
    queryKey: [network, 'walform:allowlist-events', originalPackageId],
    enabled: !!originalPackageId && !!formId && !!activeNetwork,
    staleTime: 10_000,
    queryFn: async () => {
      if (!originalPackageId || !activeNetwork) return [];
      return collectEventsGql<AllowlistCreatedEvent>({
        network: activeNetwork,
        eventType: `${originalPackageId}::events::AllowlistCreated`,
        order: 'descending',
      });
    },
  });

  const matched = useMemo(() => {
    if (!formId) return null;
    const target = normalizeSuiAddress(formId);
    for (const parsed of eventsQuery.data ?? []) {
      if (!parsed?.allowlist_id || !parsed.form_id) continue;
      if (normalizeSuiAddress(parsed.form_id) !== target) continue;
      return parsed;
    }
    return null;
  }, [eventsQuery.data, formId]);

  const allowlistObjQuery = useQuery({
    queryKey: [network, 'walform:allowlist', matched?.allowlist_id ?? null],
    enabled: !!matched?.allowlist_id,
    queryFn: ({ signal }) => getMoveObject(client, Allowlist, matched!.allowlist_id!, signal),
  });

  const allowlist = useMemo<FormAllowlist | null>(() => {
    if (!matched) return null;
    // `members` is a `VecSet<address>`; BCS decodes it to `{contents: [...]}`
    // with no JSON-RPC `fields` wrapper to unwrap.
    const members = allowlistObjQuery.data?.fields.members.contents ?? [];
    return {
      allowlistId: normalizeSuiAddress(matched.allowlist_id!),
      formId: normalizeSuiAddress(matched.form_id!),
      creator: matched.creator ? normalizeSuiAddress(matched.creator) : '',
      members: members.map((m) => normalizeSuiAddress(m)),
      createdAtMs: Number(matched.created_at_ms ?? 0),
    };
  }, [matched, allowlistObjQuery.data]);

  return {
    allowlist,
    isLoading:
      (!!originalPackageId && !!formId && eventsQuery.isPending) ||
      (!!matched?.allowlist_id && allowlistObjQuery.isPending),
    error: (eventsQuery.error as Error | null) ?? (allowlistObjQuery.error as Error | null) ?? null,
  };
}
