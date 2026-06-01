'use client';

import { Coins, Lock, Wallet } from 'lucide-react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { formatSui } from '../../lib/sui-amount';
import type { TokenGateState, UseFormSubmissionResult } from '../../hooks/use-form-submission';
import type { FormOnChainDetail } from '../../hooks/use-form-on-chain';

interface AccessModeBannerProps {
  form: FormOnChainDetail;
  allowlistQuery: UseFormSubmissionResult['allowlistQuery'];
  treasuryQuery: UseFormSubmissionResult['treasuryQuery'];
  tokenGate: TokenGateState;
  accountAddress: string | undefined;
}

/**
 * Header strip above each form that explains the access policy + the
 * connected wallet's eligibility (allowlist member? token holder? balance
 * sufficient for paid?). Pure presentation — gate logic lives in
 * `useFormSubmission`.
 */
export function AccessModeBanner({
  form,
  allowlistQuery,
  treasuryQuery,
  tokenGate,
  accountAddress,
}: AccessModeBannerProps) {
  if (form.accessMode === 0) return null;

  return (
    <div className="border-b px-6 py-3 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        {form.accessMode === 1 && (
          <PrivateBanner
            form={form}
            allowlistQuery={allowlistQuery}
            accountAddress={accountAddress}
          />
        )}
        {form.accessMode === 2 && <TokenGatedBanner form={form} tokenGate={tokenGate} />}
        {form.accessMode === 3 && <PaidBanner form={form} treasuryQuery={treasuryQuery} />}
      </div>
    </div>
  );
}

function PrivateBanner({
  form,
  allowlistQuery,
  accountAddress,
}: {
  form: FormOnChainDetail;
  allowlistQuery: UseFormSubmissionResult['allowlistQuery'];
  accountAddress: string | undefined;
}) {
  const { isConnected } = useCurrentWallet();
  return (
    <>
      <Lock className="text-muted-foreground h-3.5 w-3.5" />
      {!isConnected ? (
        <span>Private form — connect a wallet on the allowlist to submit.</span>
      ) : allowlistQuery.isLoading ? (
        <span>Resolving allowlist…</span>
      ) : !allowlistQuery.allowlist ? (
        <span>No allowlist found for this form. The creator may need to re-publish.</span>
      ) : accountAddress &&
        !allowlistQuery.allowlist.members.some((m) => m === accountAddress) &&
        accountAddress !== form.owner ? (
        <span className="text-destructive">Your wallet isn&apos;t on the allowlist.</span>
      ) : (
        <span>You&apos;re on the allowlist — fill the form below to submit.</span>
      )}
    </>
  );
}

function TokenGatedBanner({
  form,
  tokenGate,
}: {
  form: FormOnChainDetail;
  tokenGate: TokenGateState;
}) {
  const { isConnected } = useCurrentWallet();
  return (
    <>
      <Coins className="text-muted-foreground h-3.5 w-3.5" />
      {!isConnected ? (
        <span className="min-w-0 break-words">
          Token-gated form — connect a wallet holding {form.requiredTokenAmount.toString()} of{' '}
          <code className="font-mono break-all">{form.requiredTokenType}</code> to submit.
        </span>
      ) : tokenGate.isPending ? (
        <span>Checking your balance…</span>
      ) : !tokenGate.meets ? (
        <span className="text-destructive min-w-0 break-words">
          Your wallet holds {tokenGate.held.toString()} but {form.requiredTokenAmount.toString()} of{' '}
          <code className="font-mono break-all">{form.requiredTokenType}</code> is required.
        </span>
      ) : (
        <span>You hold the required tokens — fill the form below.</span>
      )}
    </>
  );
}

function PaidBanner({
  form,
  treasuryQuery,
}: {
  form: FormOnChainDetail;
  treasuryQuery: UseFormSubmissionResult['treasuryQuery'];
}) {
  const { isConnected } = useCurrentWallet();
  return (
    <>
      <Wallet className="text-muted-foreground h-3.5 w-3.5" />
      {!isConnected ? (
        <span>
          Paid form — connect a wallet with at least {formatSui(form.submissionFeeMist)} SUI to
          submit.
        </span>
      ) : treasuryQuery.isLoading ? (
        <span>Resolving treasury…</span>
      ) : !treasuryQuery.treasury ? (
        <span className="text-destructive">
          No treasury found for this paid form. The creator may need to re-publish.
        </span>
      ) : (
        <span>
          {formatSui(form.submissionFeeMist)} SUI per submit — fee and gas are paid from your
          connected wallet.
        </span>
      )}
    </>
  );
}
