'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Logo } from '../../../ui/logo';
import { Spinner } from '../../../ui/spinner';
import { WalletButton } from '../../../sui/wallet-ui/WalletButton';
import { WalletConnectModal } from '../../../sui/wallet-ui/WalletConnectModal';
import { CoverImageView } from '../editor/CoverImage';
import { ThemeToggle } from '../editor/ThemeToggle';
import { FormPreview } from '../preview/FormPreview';
import { useFormSubmission } from '../../hooks/use-form-submission';
import { usePrefillFromHash } from '../../hooks/use-prefill-from-hash';
import { buildFormAreaStyle } from '../../lib/form-appearance';
import { getFormFont } from '../../lib/form-fonts';
import { formatSui } from '../../lib/sui-amount';
import { cn } from '../../../lib/utils';
import type { FormOnChainDetail } from '../../hooks/use-form-on-chain';
import { AccessModeBanner } from './AccessModeBanner';
import { PrefillBanner } from './PrefillBanner';

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
  const { account, allowlistQuery, treasuryQuery, tokenGate, isSubmitting } = submission;
  const prefill = usePrefillFromHash();

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
          />
        </div>
        {isSubmitting && (
          <div className="text-muted-foreground mt-4 flex items-center gap-2 text-xs">
            <Spinner className="size-3.5" />
            Encrypting + submitting on-chain…
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
