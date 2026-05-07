'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useActivePackageId } from '../../sui/package-id';
import { buildCloseFormTx } from '../../sui/tx/close-form';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';

export interface UseCloseFormInput {
  formId: string;
  capId: string;
}

export interface UseCloseFormResult {
  isClosing: boolean;
  close: () => Promise<boolean>;
}

/**
 * Close-form action signed by the connected wallet. Returns `true` on success
 * so the caller can close its confirm dialog without watching state. Failures
 * toast inline and resolve `false` so the dialog stays open.
 */
export function useCloseForm({ formId, capId }: UseCloseFormInput): UseCloseFormResult {
  const packageId = useActivePackageId();
  const { execute } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();
  const [isClosing, setIsClosing] = useState(false);

  const close = async (): Promise<boolean> => {
    if (!packageId) return false;
    setIsClosing(true);
    try {
      const tx = buildCloseFormTx({
        packageId,
        formObjectId: formId,
        capObjectId: capId,
      });
      const { digest } = await execute({ transaction: tx });
      await invalidateChain(digest);
      toast.success('Form closed — no new submissions accepted.');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Close failed: ${msg}`);
      return false;
    } finally {
      setIsClosing(false);
    }
  };

  return { isClosing, close };
}
