'use client';

import { notFound, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useFormOnChain } from '../../hooks/use-form-on-chain';
import { useStoredForm } from '../../hooks/use-stored-form';
import { SCHEMA_VERSION } from '../../lib/schema-version';
import { FormBuilder } from './FormBuilder';

interface FormEditorClientProps {
  id: string;
}

/**
 * Editor entry point. Three paths:
 *  - id matches an IDB draft → render the FormBuilder.
 *  - id matches an on-chain Form → redirect: owner goes to /results
 *    (no editing post-publish), anyone else goes to /f/[id] to submit.
 *  - neither → notFound.
 */
export function FormEditorClient({ id }: FormEditorClientProps) {
  const router = useRouter();
  const account = useCurrentAccount();
  const state = useStoredForm(id);
  const draftMissing = state.status === 'not-found';

  const { form: onChainForm, isLoading: chainLoading } = useFormOnChain(
    draftMissing ? id : undefined,
  );

  useEffect(() => {
    if (!draftMissing || !onChainForm) return;
    const isOwner = !!account && account.address === onChainForm.owner;
    router.replace(isOwner ? `/forms/${id}/results` : `/f/${id}`);
  }, [draftMissing, onChainForm, account, id, router]);

  if (draftMissing) {
    if (chainLoading || onChainForm) {
      return <div className="bg-muted/30 min-h-screen animate-pulse" />;
    }
    notFound();
  }

  if (state.status === 'loading') {
    return <div className="bg-muted/30 min-h-screen animate-pulse" />;
  }

  if (state.status === 'unsupported-version') {
    return (
      <div className="bg-muted/30 flex min-h-screen items-center justify-center px-6">
        <div className="bg-card w-full max-w-md rounded-xl border p-6 text-center shadow-lg">
          <p className="text-base font-semibold">This form is from a newer version</p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            The draft was saved by a newer build (schema v{state.foundVersion}). Update the app to v
            {SCHEMA_VERSION + 1}+ to open it. Editing it now would risk losing data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <FormBuilder formId={id} createdAt={state.form.createdAt} initialRev={state.form.rev ?? 0} />
  );
}
