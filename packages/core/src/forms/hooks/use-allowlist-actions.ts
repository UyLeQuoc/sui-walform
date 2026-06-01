'use client';

import { useState } from 'react';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { toast } from 'sonner';
import { useActivePackageId } from '../../sui/package-id';
import {
  buildAddAllowlistMembersTx,
  buildRemoveAllowlistMemberTx,
} from '../../sui/tx/allowlist';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';

export interface UseAllowlistActionsResult {
  /** Add addresses to the submit allowlist. Owner-only (FormOwnerCap id). */
  addMembers: (members: string[], capId: string) => Promise<void>;
  /** Remove one address. Owner-only. */
  removeMember: (member: string, capId: string) => Promise<void>;
  isMutating: boolean;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]+$/;

/**
 * Owner actions for a form's submit Allowlist (`allowlist::add_many` /
 * `remove`), mirroring `useFormReviewers`. Reads of the allowlist itself go
 * through `useFormAllowlist`. After each mutation we `invalidateChain` so the
 * membership list AND the sealed-schema decrypt gate (which authorizes
 * allowlist members) refresh.
 */
export function useAllowlistActions(allowlistId: string | null): UseAllowlistActionsResult {
  const packageId = useActivePackageId();
  const { execute } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const [isMutating, setIsMutating] = useState(false);

  const addMembers = async (members: string[], capId: string) => {
    if (!packageId || !allowlistId) {
      toast.error('No allowlist found for this form.');
      return;
    }
    const cleaned: string[] = [];
    for (const raw of members) {
      const t = raw.trim();
      if (!t) continue;
      if (!ADDRESS_RE.test(t)) {
        toast.error(`Not a valid Sui address: ${t}`);
        return;
      }
      cleaned.push(normalizeSuiAddress(t));
    }
    if (cleaned.length === 0) {
      toast.error('Enter at least one Sui address.');
      return;
    }
    setIsMutating(true);
    try {
      const tx = buildAddAllowlistMembersTx({
        packageId,
        allowlistId,
        formOwnerCapId: capId,
        members: cleaned,
      });
      const { digest } = await execute({ transaction: tx });
      await invalidateChain(digest);
      toast.success(
        cleaned.length === 1 ? 'Address added to allowlist.' : `${cleaned.length} addresses added.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Add failed: ${msg}`);
    } finally {
      setIsMutating(false);
    }
  };

  const removeMember = async (member: string, capId: string) => {
    if (!packageId || !allowlistId) {
      toast.error('No allowlist found for this form.');
      return;
    }
    setIsMutating(true);
    try {
      const tx = buildRemoveAllowlistMemberTx({
        packageId,
        allowlistId,
        formOwnerCapId: capId,
        member,
      });
      const { digest } = await execute({ transaction: tx });
      await invalidateChain(digest);
      toast.success('Address removed from allowlist.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Remove failed: ${msg}`);
    } finally {
      setIsMutating(false);
    }
  };

  return { addMembers, removeMember, isMutating };
}
