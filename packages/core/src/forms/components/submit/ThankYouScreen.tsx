'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ExternalLink, FilePlus, Receipt } from 'lucide-react';
import { Button } from '../../../ui/button';
import { suivisionUrl, type ExplorerNetwork } from '../../../sui/explorer';
import type { FormOnChainDetail } from '../../hooks/use-form-on-chain';
import type { SubmissionRow } from '../../hooks/use-form-submissions';
import { shortAddr } from '../../lib/format-address';
import { isInputField } from '../../lib/field-types';
import { InlineReceipt } from './InlineReceipt';

type Variant =
  | { kind: 'just-submitted'; digest: string }
  | { kind: 'already-submitted'; submissionId: string };

interface ThankYouScreenProps {
  form: FormOnChainDetail & { schema: NonNullable<FormOnChainDetail['schema']> };
  network: ExplorerNetwork;
  variant: Variant;
  submitter: string;
  submittedAtMs: number;
  /** The on-chain submission row for the connected wallet. Required to power
   * the inline receipt — already-submitted variants will always have one,
   * just-submitted reuses the in-session row once chain catches up. */
  myRow?: SubmissionRow | null;
  /** Called when the respondent wants to fill the form out again. The view
   * layer then clears the success state and rerenders FormPreview. */
  onSubmitAnother: () => void;
}

const DEFAULT_MESSAGE = 'Thank you for your response!';

/**
 * Post-submit confirmation panel. Replaces the form area when either:
 *
 * - `just-submitted` — fresh in-session submit (shows the creator's
 *   `successMessage`).
 * - `already-submitted` — wallet has a prior on-chain submission discovered
 *   on reload. Simpler layout, no hero icon.
 *
 * Both variants offer a "View my response" toggle that expands an inline
 * receipt (`InlineReceipt`) below the meta card — the standalone /receipt
 * page was removed in favour of this inline flow.
 */
export function ThankYouScreen({
  form,
  network,
  variant,
  submitter,
  submittedAtMs,
  myRow,
  onSubmitAnother,
}: ThankYouScreenProps) {
  const message = form.schema.settings.successMessage?.trim() || DEFAULT_MESSAGE;
  const capReached =
    form.maxSubmissions > 0 && form.submissionCount + 1 >= form.maxSubmissions;
  const isJustSubmitted = variant.kind === 'just-submitted';
  const receiptHref = isJustSubmitted
    ? suivisionUrl(network, 'txblock', variant.digest)
    : suivisionUrl(network, 'object', variant.submissionId);
  const receiptId = isJustSubmitted ? variant.digest : variant.submissionId;
  const receiptLabel = isJustSubmitted ? 'Tx digest' : 'Submission';
  const inputFields = (form.schema.fields ?? []).filter(isInputField);

  const [receiptOpen, setReceiptOpen] = useState(false);

  return (
    <div className="flex flex-col gap-5 px-6 py-8">
      {isJustSubmitted ? (
        <div className="flex items-start gap-3">
          <span className="bg-primary/15 text-primary inline-flex size-9 shrink-0 items-center justify-center rounded-full">
            <CheckCircle2 className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-xl font-semibold">{form.title}</h1>
            <p className="text-foreground/90 text-sm whitespace-pre-line">{message}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <h1 className="text-primary text-lg font-semibold">You already responded</h1>
          <p className="text-muted-foreground text-sm">
            This wallet has already submitted a response to{' '}
            <span className="text-foreground font-medium">{form.title}</span>.
          </p>
        </div>
      )}

      <dl className="bg-muted/40 grid grid-cols-1 gap-x-4 gap-y-2 rounded-md border p-3 text-xs sm:grid-cols-3">
        <MetaItem label="Submitted">{new Date(submittedAtMs).toLocaleString()}</MetaItem>
        <MetaItem label="From">
          <code className="font-mono">{shortAddr(submitter)}</code>
        </MetaItem>
        <MetaItem label={receiptLabel}>
          <a
            href={receiptHref}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
          >
            <code className="font-mono">{shortAddr(receiptId)}</code>
            <ExternalLink className="size-3" />
          </a>
        </MetaItem>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        {myRow && (
          <Button
            variant={isJustSubmitted ? 'outline' : 'default'}
            size="sm"
            onClick={() => setReceiptOpen((v) => !v)}
          >
            <Receipt className="mr-1.5 size-3.5" />
            {receiptOpen ? 'Hide my response' : 'View my response'}
            {receiptOpen ? (
              <ChevronUp className="ml-1 size-3.5" />
            ) : (
              <ChevronDown className="ml-1 size-3.5" />
            )}
          </Button>
        )}
        {!capReached && !form.closed && (
          <Button
            variant={isJustSubmitted ? 'default' : 'outline'}
            size="sm"
            onClick={onSubmitAnother}
          >
            <FilePlus className="mr-1.5 size-3.5" />
            Submit another response
          </Button>
        )}
      </div>

      {receiptOpen && myRow && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <InlineReceipt formId={form.formObjectId} row={myRow} fields={inputFields} />
        </div>
      )}

      {capReached && (
        <p className="text-muted-foreground text-xs">
          This form is now at its submission cap ({form.maxSubmissions}). Thanks for being part of
          it.
        </p>
      )}

      <p className="text-muted-foreground/70 text-[11px]">
        Your response is end-to-end encrypted with Seal and stored on-chain. Only the form creator
        and you can decrypt it.
      </p>
    </div>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
