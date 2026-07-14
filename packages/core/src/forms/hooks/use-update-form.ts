'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { useActivePackageId } from '../../sui/package-id';
import { buildUpdateSchemaTx } from '../../sui/tx/update-schema';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';
import { useFormBuilderStore } from '../store/form-builder-store';
import { useOnChainForms } from './use-on-chain-forms';
import { useTxSteps, type UseTxStepsResult } from './use-tx-steps';

export interface UseUpdateFormInput {
  /** The shared Form object id being edited. */
  formObjectId: string;
}

export interface UseUpdateFormResult {
  isSubmitting: boolean;
  /** Push the current editor schema to chain via `update_schema`. Returns the
   *  digest on success, or null on failure / not-owner / not-configured. */
  update: () => Promise<{ digest: string } | null>;
  /** True iff the connected wallet owns this form (FormOwnerCap found) and the
   *  active network has a deployed walform package. */
  isReady: boolean;
  steps: UseTxStepsResult;
}

/**
 * Edit-in-place for a published Form. Resolves the caller's FormOwnerCap for
 * `formObjectId`, then rewrites the on-chain schema bytes with whatever the
 * editor store currently holds. Plaintext-only — sealed schemas are gated out
 * upstream (the editor never enters update mode when the schema can't decode).
 * Contract-free: reuses the existing `update_schema` entry function.
 */
export function useUpdateForm({ formObjectId }: UseUpdateFormInput): UseUpdateFormResult {
  const packageId = useActivePackageId();
  const { execute, sender } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const { running, ended } = useOnChainForms();
  const steps = useTxSteps();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const target = normalizeSuiAddress(formObjectId);
  const formOwnerCapId =
    [...running, ...ended].find((f) => normalizeSuiAddress(f.formId) === target)?.capId ?? null;

  const isReady = Boolean(packageId && formOwnerCapId);

  const update = useCallback(async (): Promise<{ digest: string } | null> => {
    if (!sender || !packageId) {
      toast.error('Connect a wallet on a network with a deployed walform package.');
      return null;
    }
    if (!formOwnerCapId) {
      toast.error('You are not the owner of this form (no FormOwnerCap found).');
      return null;
    }
    setIsSubmitting(true);
    steps.start([
      { id: 'sign', label: 'Sign the update transaction in your wallet' },
      { id: 'broadcast', label: 'Broadcasting to Sui' },
      { id: 'confirm', label: 'Confirming on-chain' },
    ]);
    try {
      const schema = useFormBuilderStore.getState().schema;
      const schemaBytes = new TextEncoder().encode(JSON.stringify(schema));
      const tx = buildUpdateSchemaTx({ packageId, formObjectId, formOwnerCapId, schemaBytes });

      steps.advance('sign', 'Approve the transaction in your wallet.');
      const { digest } = await execute({ transaction: tx });
      steps.advance('broadcast');
      steps.advance('confirm');
      await invalidateChain(digest);

      steps.finishOk();
      toast.success('Form updated on-chain');
      return { digest };
    } catch (err) {
      steps.finishError();
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Update failed: ${msg}`);
      console.error(err);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [sender, packageId, formOwnerCapId, formObjectId, execute, invalidateChain, steps]);

  return { isSubmitting, update, isReady, steps };
}
