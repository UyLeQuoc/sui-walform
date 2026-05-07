'use client';

import { useMemo } from 'react';
import { useSuiClientContext, useSuiClientQuery } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { useOriginalPackageId } from '../../sui/package-id';

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

  const eventsQuery = useSuiClientQuery(
    'queryEvents',
    {
      query: originalPackageId
        ? {
            MoveEventType: `${originalPackageId}::events::AllowlistCreated`,
          }
        : ({} as never),
      order: 'descending',
      limit: 200,
    },
    { enabled: !!originalPackageId && !!formId },
  );

  const matched = useMemo(() => {
    if (!formId) return null;
    const target = normalizeSuiAddress(formId);
    const events = eventsQuery.data?.data ?? [];
    for (const ev of events) {
      const parsed = ev.parsedJson as
        | {
            allowlist_id?: string;
            form_id?: string;
            creator?: string;
            created_at_ms?: string | number;
          }
        | undefined;
      if (!parsed?.allowlist_id || !parsed.form_id) continue;
      if (normalizeSuiAddress(parsed.form_id) !== target) continue;
      return parsed;
    }
    return null;
  }, [eventsQuery.data, formId]);

  const allowlistObjQuery = useSuiClientQuery(
    'getObject',
    {
      id: matched?.allowlist_id ?? '',
      options: { showContent: true, showType: true },
    },
    { enabled: !!matched?.allowlist_id },
  );

  const allowlist = useMemo<FormAllowlist | null>(() => {
    if (!matched) return null;
    const data = allowlistObjQuery.data?.data;
    let members: string[] = [];
    if (data?.content) {
      const content = data.content as unknown as
        | {
            dataType: 'moveObject';
            fields: {
              members?: { fields?: { contents?: string[] } } | { contents?: string[] } | string[];
            };
          }
        | undefined;
      const rawMembers = content?.fields?.members;
      if (Array.isArray(rawMembers)) {
        members = rawMembers as string[];
      } else if (rawMembers && typeof rawMembers === 'object') {
        const obj = rawMembers as { fields?: { contents?: string[] } } | { contents?: string[] };
        const inner =
          ('fields' in obj ? obj.fields?.contents : undefined) ??
          ('contents' in obj ? obj.contents : undefined);
        if (Array.isArray(inner)) members = inner as string[];
      }
    }
    return {
      allowlistId: normalizeSuiAddress(matched.allowlist_id!),
      formId: normalizeSuiAddress(matched.form_id!),
      creator: matched.creator ? normalizeSuiAddress(matched.creator) : '',
      members: members.map((m) => normalizeSuiAddress(m)),
      createdAtMs: Number(matched.created_at_ms ?? 0),
    };
  }, [matched, allowlistObjQuery.data]);

  void network;
  return {
    allowlist,
    isLoading:
      (!!originalPackageId && !!formId && eventsQuery.isPending) ||
      (!!matched?.allowlist_id && allowlistObjQuery.isPending),
    error: (eventsQuery.error as Error | null) ?? (allowlistObjQuery.error as Error | null) ?? null,
  };
}
