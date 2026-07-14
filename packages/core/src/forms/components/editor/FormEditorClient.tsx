'use client';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { isCollabConfigured } from '../../hooks/use-collab-session';
import { useFormOnChain } from '../../hooks/use-form-on-chain';
import { useStoredForm } from '../../hooks/use-stored-form';
import { formsRoute } from '../../lib/routes';
import { SCHEMA_VERSION } from '../../lib/schema-version';
import { createEmptyStoredForm, useFormBuilderStore } from '../../store/form-builder-store';
import { NotFound } from '../../../ui/not-found';
import { CollabProvider } from './CollabProvider';
import { FormBuilder } from './FormBuilder';

interface FormEditorClientProps {
  id: string;
}

/**
 * Editor entry point. Paths:
 *  - id matches an IDB draft → render the FormBuilder (collab as host once a
 *    share token `?t=` is present).
 *  - id missing but a share token `?t=` is present → join a collab session; the
 *    session projects the real schema from the server over an empty shell.
 *  - id matches an on-chain Form → redirect: owner goes to /results, anyone
 *    else goes to /f?formId=… to submit. This is checked even on a collab link,
 *    so reopening a now-published form's invite never rejoins the retired room.
 *  - neither → notFound.
 */
export function FormEditorClient({ id }: FormEditorClientProps) {
  const navigate = useNavigate();
  const account = useCurrentAccount();
  const [params] = useSearchParams();
  const token = params.get('t');
  // The share token is the only collab signal — it's the capability AND what the
  // host mints on "Start collaboration". Gated on the build actually being able
  // to network, so an unconfigured build behaves like the local-only editor.
  const collabEnabled = !!token && isCollabConfigured();

  const state = useStoredForm(id);
  const draftMissing = state.status === 'not-found';

  // Always resolve on-chain status when the local draft is missing — for a plain
  // missing id (redirect/notFound) AND for a collab link (so a published form's
  // stale link redirects instead of rejoining a retired room).
  const { form: onChainForm, isLoading: chainLoading } = useFormOnChain(
    draftMissing ? id : undefined,
  );

  const joinMissing = draftMissing && collabEnabled;

  const isOwner =
    !!account &&
    !!onChainForm &&
    normalizeSuiAddress(account.address) === normalizeSuiAddress(onChainForm.owner);
  // Owner + a decodable (plaintext) schema → edit the live form in place.
  // Sealed schemas (schema === null) can't be re-edited yet, so they redirect.
  const canEditOnChain = draftMissing && !!onChainForm && isOwner && onChainForm.schema !== null;
  const [onChainHydrated, setOnChainHydrated] = useState(false);

  useEffect(() => {
    // Mount the empty shell only once we know the form isn't already on-chain.
    if (!joinMissing || chainLoading || onChainForm) return;
    useFormBuilderStore.getState().loadFromDb(createEmptyStoredForm(id));
  }, [joinMissing, chainLoading, onChainForm, id]);

  useEffect(() => {
    // Hydrate the editor store from the on-chain schema before entering edit mode.
    if (!canEditOnChain || !onChainForm?.schema) return;
    useFormBuilderStore
      .getState()
      .loadFromDb({ ...createEmptyStoredForm(id), schema: onChainForm.schema });
    setOnChainHydrated(true);
  }, [canEditOnChain, onChainForm, id]);

  useEffect(() => {
    // Redirect only when we're NOT editing in place: non-owner → submit,
    // owner-of-sealed-form → results.
    if (!draftMissing || !onChainForm || canEditOnChain) return;
    navigate(isOwner ? formsRoute.results(id) : formsRoute.submit(id), { replace: true });
  }, [draftMissing, onChainForm, canEditOnChain, isOwner, id, navigate]);

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

  if (canEditOnChain && onChainForm) {
    // Owner editing a published form in place. Wait for the store to hydrate
    // from the on-chain schema so we never flash stale editor content.
    if (!onChainHydrated) {
      return <div className="bg-muted/30 min-h-screen animate-pulse" />;
    }
    return (
      <FormBuilder
        formId={id}
        createdAt={0}
        initialRev={0}
        autoSave={false}
        onChainEdit={{
          formObjectId: onChainForm.formObjectId,
          submissionCount: onChainForm.submissionCount,
        }}
      />
    );
  }

  if (draftMissing) {
    // Resolving the chain, or redirecting because it's published.
    if (chainLoading || onChainForm) {
      return <div className="bg-muted/30 min-h-screen animate-pulse" />;
    }
    // Not on-chain and no collab token → genuinely nothing to open.
    if (!collabEnabled) return <NotFound />;
    // Otherwise fall through to join: the empty shell is mounted by the effect.
  }

  const createdAt = state.status === 'ready' ? state.form.createdAt : 0;
  const initialRev = state.status === 'ready' ? (state.form.rev ?? 0) : 0;
  const sourceTemplate = state.status === 'ready' ? state.form.sourceTemplate : undefined;
  const mode = draftMissing ? 'join' : 'host';

  return (
    <CollabProvider formId={id} enabled={collabEnabled} mode={mode} token={token}>
      <FormBuilder
        formId={id}
        createdAt={createdAt}
        initialRev={initialRev}
        sourceTemplate={sourceTemplate}
        autoSave={mode === 'host'}
      />
    </CollabProvider>
  );
}
