'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { Logo } from '../../../ui/logo';
import { NetworkBadge, WalletButton } from '../../../sui/wallet-ui';
import { WalletConnectModal } from '../../../sui/wallet-ui/WalletConnectModal';
import type { ExplorerNetwork } from '../../../sui/explorer';
import { CoverImageView } from '../editor/CoverImage';
import { ThemeToggle } from '../editor/ThemeToggle';
import { FormPreview } from '../preview/FormPreview';
import { TxSteps } from '../shared/TxSteps';
import { useFormSubmission } from '../../hooks/use-form-submission';
import { useFormSubmissions } from '../../hooks/use-form-submissions';
import { usePrefillFromHash } from '../../hooks/use-prefill-from-hash';
import { buildFormAreaStyle } from '../../lib/form-appearance';
import { getFormFont } from '../../lib/form-fonts';
import { formatSui } from '../../lib/sui-amount';
import { cn } from '../../../lib/utils';
import type { FormOnChainDetail } from '../../hooks/use-form-on-chain';
import { AccessModeBanner } from './AccessModeBanner';
import { PrefillBanner } from './PrefillBanner';
import { ThankYouScreen } from './ThankYouScreen';

interface SubmitFormProps {
  /** Required to have a non-null `schema`. The schema may have been
   * decrypted from `schemaRaw` upstream by `SealedSchemaGate`. */
  form: FormOnChainDetail & { schema: NonNullable<FormOnChainDetail['schema']> };
}

const ACCESS_MODE_LABEL: Record<0 | 1 | 2 | 3, (form: FormOnChainDetail) => string> = {
  0: () => 'Public form',
  1: () => 'Private form (allowlist)',
  2: () => 'Token-gated form',
  3: (form) => `Paid form · ${formatSui(form.submissionFeeMist)} SUI per submit`,
};

/**
 * Authenticated submit shell — renders the form preview, access banner, and
 * connect modal. All flow logic (encryption, paid coin selection, wallet
 * sign-and-execute) lives in `useFormSubmission`.
 */
export function SubmitForm({ form }: SubmitFormProps) {
  const submission = useFormSubmission(form);
  const {
    account,
    allowlistQuery,
    treasuryQuery,
    tokenGate,
    isSubmitting,
    submitted,
    resetSubmitted,
    steps: txSteps,
  } = submission;
  const prefill = usePrefillFromHash();
  const { network: rawNetwork } = useSuiClientContext();
  const network: ExplorerNetwork =
    rawNetwork === 'mainnet' || rawNetwork === 'devnet' ? rawNetwork : 'testnet';

  // On reload we lose the in-session `submitted` flag, but the on-chain
  // SubmissionCreated event still tells us the connected wallet already
  // responded. Surface that via the same thank-you screen rather than
  // rendering an empty form. Pick the most-recent prior row.
  const { rows: chainRows } = useFormSubmissions(form.formObjectId);
  const myAddr = account?.address ? normalizeSuiAddress(account.address) : null;
  const myPriorRow = useMemo(() => {
    if (!myAddr) return null;
    return chainRows.find((r) => normalizeSuiAddress(r.submitter) === myAddr) ?? null;
  }, [chainRows, myAddr]);
  // Once the user dismisses the "already responded" screen via "Submit
  // another", we hide it for the rest of the session so the form is
  // editable again even though the prior row still exists on-chain.
  const [dismissedPriorRow, setDismissedPriorRow] = useState(false);
  const handleSubmitAnother = () => {
    resetSubmitted();
    setDismissedPriorRow(true);
  };
  const showAlreadySubmitted = !submitted && !!myPriorRow && !dismissedPriorRow;

  const formAreaStyle = useMemo(
    () =>
      buildFormAreaStyle(
        getFormFont(form.schema.settings.fontFamily).fontFamily,
        form.schema.settings.borderRadius ?? 4,
        form.schema.settings.primaryColor ?? 'default',
      ),
    [form.schema.settings],
  );
  const isPageMode = (form.schema.settings.displayMode ?? 'card') === 'page';

  return (
    <div
      className={cn(
        'flex min-h-screen flex-col items-center px-4 py-10 sm:py-16',
        isPageMode ? 'bg-card' : 'bg-secondary/40',
      )}
    >
      <div className="mb-3 flex w-full max-w-2xl items-center justify-between">
        <Link href="/" aria-label="WalForm home" className="flex items-center gap-2">
          <Logo className="size-5" />
          <span className="text-muted-foreground text-xs">
            {ACCESS_MODE_LABEL[form.accessMode](form)}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <NetworkBadge />
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>
      <div className="flex w-full max-w-4xl flex-col items-center" style={formAreaStyle}>
        {form.schema.coverImage && (
          <div className="mb-4 w-full">
            <CoverImageView src={form.schema.coverImage} />
          </div>
        )}
        <div
          className={cn(
            'w-full max-w-2xl rounded-xl',
            isPageMode ? 'bg-transparent' : 'bg-card border shadow-xl',
          )}
        >
          {submitted ? (
            <ThankYouScreen
              form={form}
              network={network}
              variant={{ kind: 'just-submitted', digest: submitted.digest }}
              submitter={submitted.submitter}
              submittedAtMs={submitted.submittedAtMs}
              myRow={myPriorRow}
              onSubmitAnother={handleSubmitAnother}
            />
          ) : showAlreadySubmitted && myPriorRow ? (
            <ThankYouScreen
              form={form}
              network={network}
              variant={{ kind: 'already-submitted', submissionId: myPriorRow.submissionId }}
              submitter={myPriorRow.submitter}
              submittedAtMs={myPriorRow.submittedAtMs}
              myRow={myPriorRow}
              onSubmitAnother={handleSubmitAnother}
            />
          ) : (
            <>
              {prefill && <PrefillBanner />}
              <AccessModeBanner
                form={form}
                allowlistQuery={allowlistQuery}
                treasuryQuery={treasuryQuery}
                tokenGate={tokenGate}
                accountAddress={account?.address}
              />
              <FormPreview
                schema={form.schema}
                onSubmit={submission.submit}
                prefill={prefill ?? undefined}
                isSubmitting={isSubmitting}
              />
            </>
          )}
        </div>
        {isSubmitting && !submitted && txSteps.steps.length > 0 && (
          <div className="bg-card mt-4 w-full max-w-2xl rounded-xl border p-4 shadow-sm">
            <p className="text-foreground mb-3 text-xs font-medium tracking-wide uppercase">
              Submitting your response
            </p>
            <TxSteps steps={txSteps.steps} />
          </div>
        )}
        <p className="text-muted-foreground/70 mt-4 max-w-2xl text-center text-[11px]">
          Your responses are end-to-end encrypted with Seal and stored on-chain. Only the form
          creator and you can decrypt them.
        </p>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1.5 text-[11px] transition-colors"
        >
          <Logo className="size-3.5" />
          Made with <span className="font-medium">WalForm</span>
        </Link>
      </div>
      <WalletConnectModal
        open={submission.connectOpen}
        onOpenChange={submission.setConnectOpen}
        onConnected={submission.onConnected}
      />
    </div>
  );
}
