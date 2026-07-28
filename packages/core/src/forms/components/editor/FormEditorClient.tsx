'use client';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { Lock, Unlock } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Spinner } from '../../../ui/spinner';
import { isCollabConfigured } from '../../hooks/use-collab-session';
import { useFormOnChain } from '../../hooks/use-form-on-chain';
import { useSealedSchemaDecrypt } from '../../hooks/use-sealed-schema-decrypt';
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

/** Stable placeholder so the sealed-schema hook input doesn't churn per render. */
const EMPTY_CIPHERTEXT = new Uint8Array();

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

  // Private forms store the schema as a Seal ciphertext. The owner can still
  // edit them — it just takes a decrypt first, which is why this hook runs
  // before `canEditOnChain` is decided rather than the form being redirected
  // away to /results.
  const sealedCiphertext = useMemo(
    () => (onChainForm?.schemaSealed ? onChainForm.schemaRaw : EMPTY_CIPHERTEXT),
    [onChainForm?.schemaSealed, onChainForm?.schemaRaw],
  );
  const sealedSchema = useSealedSchemaDecrypt({
    formObjectId: onChainForm?.formObjectId ?? id,
    ciphertext: sealedCiphertext,
  });
  const onChainSchema = onChainForm?.schema ?? sealedSchema.decrypted;
  // Owner + a schema we can actually read (plaintext, or sealed-then-decrypted)
  // → edit the live form in place.
  const canEditOnChain = draftMissing && !!onChainForm && isOwner && !!onChainSchema;
  // Owner staring at a sealed form that hasn't been unlocked yet — render the
  // gate instead of redirecting.
  const needsSchemaUnlock =
    draftMissing && !!onChainForm && isOwner && !!onChainForm.schemaSealed && !onChainSchema;
  const [onChainHydrated, setOnChainHydrated] = useState(false);

  useEffect(() => {
    // Mount the empty shell only once we know the form isn't already on-chain.
    if (!joinMissing || chainLoading || onChainForm) return;
    useFormBuilderStore.getState().loadFromDb(createEmptyStoredForm(id));
  }, [joinMissing, chainLoading, onChainForm, id]);

  useEffect(() => {
    // Hydrate the editor store from the on-chain schema before entering edit mode.
    if (!canEditOnChain || !onChainSchema) return;
    useFormBuilderStore
      .getState()
      .loadFromDb({ ...createEmptyStoredForm(id), schema: onChainSchema });
    setOnChainHydrated(true);
  }, [canEditOnChain, onChainSchema, id]);

  useEffect(() => {
    // Redirect only when we're NOT editing in place and there's nothing to
    // unlock: non-owner → submit, owner of an undecodable form → results.
    if (!draftMissing || !onChainForm || canEditOnChain || needsSchemaUnlock) return;
    navigate(isOwner ? formsRoute.results(id) : formsRoute.submit(id), { replace: true });
  }, [draftMissing, onChainForm, canEditOnChain, needsSchemaUnlock, isOwner, id, navigate]);

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

  if (needsSchemaUnlock) {
    return (
      <SchemaUnlockGate
        pending={sealedSchema.pending}
        error={sealedSchema.error}
        onUnlock={() => void sealedSchema.decrypt()}
      />
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
          schemaSealed: onChainForm.schemaSealed,
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

interface SchemaUnlockGateProps {
  pending: boolean;
  error: string | null;
  onUnlock: () => void;
}

/**
 * Owner-facing gate for a Private form whose schema is Seal-encrypted. One
 * personal-message signature decrypts it into the editor store; saving
 * re-encrypts, so the form stays sealed.
 */
function SchemaUnlockGate({ pending, error, onUnlock }: SchemaUnlockGateProps) {
  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-6">
      <div className="bg-card w-full max-w-md rounded-xl border p-6 text-center shadow-lg">
        <Lock className="text-muted-foreground mx-auto h-6 w-6" />
        <p className="mt-3 text-base font-semibold">This form&apos;s questions are encrypted</p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          It was published as a Private form, so the schema is sealed to its allowlist. Unlock it to
          edit — your changes are re-encrypted when you save, so it stays private.
        </p>
        {error && <p className="text-destructive mt-3 text-xs">{error}</p>}
        <Button className="mt-4" onClick={onUnlock} disabled={pending}>
          {pending ? (
            <Spinner className="mr-1.5 size-3.5" />
          ) : (
            <Unlock className="mr-1.5 h-3.5 w-3.5" />
          )}
          Unlock and edit
        </Button>
      </div>
    </div>
  );
}
