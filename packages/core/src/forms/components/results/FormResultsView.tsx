'use client';

import { useState } from 'react';
import { Copy, Download, ExternalLink, Lock, RefreshCw, Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentAccount, useCurrentWallet, useSuiClientContext } from '@mysten/dapp-kit';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../ui/alert-dialog';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Spinner } from '../../../ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { useActivePackageId, useOriginalPackageId } from '../../../sui/package-id';
import { suivisionUrl, type ExplorerNetwork } from '../../../sui/explorer';
import { useInvalidateChainQueries } from '../../../sui/use-invalidate-chain';
import { WalletButton } from '../../../sui/wallet-ui/WalletButton';
import { useFormOnChain, useFormSubmissions, useOnChainForms } from '../../hooks';
import { useDocumentTitle } from '../../hooks/use-document-title';
import type { OnChainForm } from '../../hooks/use-on-chain-forms';
import { useCloseForm } from '../../hooks/use-close-form';
import { useSeededSubmissions } from '../../hooks/use-seeded-submissions';
import { useSubmissionDecryption } from '../../hooks/use-submission-decryption';
import { isInputField } from '../../lib/field-types';
import { shortAddr } from '../../lib/format-address';
import { buildSubmissionsCsv, downloadCsv } from '../../lib/export-submissions-csv';
import { deriveOnChainStatus } from '../../lib/form-status';
import { copyFormShareLink } from '../../lib/share-link';
import { DeployToWalrusSiteButton } from '../list/DeployToWalrusSiteButton';
import { FormStatusBadge } from '../list/FormStatusBadge';
import { WithdrawTreasuryButton } from '../list/WithdrawTreasuryButton';
import { AggregateCharts } from './AggregateCharts';
import { ResponseTimeline } from './ResponseTimeline';
import { SeedResponsesButton } from './SeedResponsesButton';
import { ShareFormDialog } from './ShareFormDialog';
import { StatsSummary } from './StatsSummary';
import { SubmissionRowCard } from './SubmissionRowCard';

interface FormResultsViewProps {
  formId: string;
}

type ResultsTab = 'summary' | 'individual' | 'manage';

/**
 * Creator's Results dashboard.
 *  - Summary tab: aggregate stats, response-over-time chart, per-question cards.
 *  - Individual tab: per-row decryptable list with explorer links.
 *  - Manage tab: owner-only — copy share link, close form, deploy site,
 *    withdraw treasury. Shown only when the connected wallet holds the cap.
 *
 * Auth model: only the form's owner can decrypt other submitters' responses
 * (Seal policy passes for `caller == form.owner` OR `caller == submission.submitter`).
 */
export function FormResultsView({ formId }: FormResultsViewProps) {
  const { isConnected } = useCurrentWallet();
  const account = useCurrentAccount();
  const { form, isLoading: formLoading } = useFormOnChain(formId);
  useDocumentTitle(form ? `${form.title} — Results` : null);
  const { rows: chainRows, isLoading: rowsLoading, error: rowsError } = useFormSubmissions(formId);
  const seededSubmissions = useSeededSubmissions(formId);
  const seededRows = seededSubmissions.map((s) => s.row);
  // Seeded rows merged with chain rows for every read path — stats, timeline,
  // aggregates, individual list. Sort newest-first so the individual tab
  // matches dApp Kit's `descending` event order.
  const rows = [...chainRows, ...seededRows].sort((a, b) => b.submittedAtMs - a.submittedAtMs);
  const { running, ended } = useOnChainForms();
  const activePackageId = useActivePackageId();
  const originalPackageId = useOriginalPackageId();
  const invalidateChain = useInvalidateChainQueries();
  const { network: rawNetwork } = useSuiClientContext();
  const network: ExplorerNetwork =
    rawNetwork === 'mainnet' || rawNetwork === 'devnet' ? rawNetwork : 'testnet';

  const decryption = useSubmissionDecryption({ formId });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<ResultsTab>('summary');
  const [shareOpen, setShareOpen] = useState(false);

  const isOwner = !!account && !!form && account.address === form.owner;
  const ownerForm = isOwner
    ? (running.find((f) => f.formId === formId) ?? ended.find((f) => f.formId === formId) ?? null)
    : null;

  const inputFields = (form?.schema?.fields ?? []).filter(isInputField);

  // Merge real Seal-decrypted rows with the pre-decrypted seeded payloads so
  // every consumer downstream (CSV, stats, aggregates, individual cards) sees
  // a uniform "this row has answers" view.
  const decryptedById: Record<string, Record<string, unknown>> = {
    ...decryption.decryptedById,
    ...Object.fromEntries(seededSubmissions.map((s) => [s.row.submissionId, s.decrypted])),
  };

  const handleCsv = () => {
    if (!form) return;
    const csv = buildSubmissionsCsv({
      rows,
      decryptedById,
      fields: inputFields,
    });
    downloadCsv(csv, `${form.title}-responses`);
  };

  if (formLoading) {
    return <div className="bg-muted h-32 animate-pulse rounded-xl" />;
  }
  if (!form) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">Form not found.</p>
        </CardContent>
      </Card>
    );
  }
  if (!isConnected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Lock className="text-muted-foreground h-6 w-6" />
          <h2 className="font-semibold">Connect a wallet</h2>
          <p className="text-muted-foreground text-sm">
            Only the form&apos;s creator can decrypt every response. Submitters can decrypt their
            own via the receipt page.
          </p>
          <WalletButton />
        </CardContent>
      </Card>
    );
  }
  // Gate the entire dashboard behind owner-cap ownership. Non-owners can
  // still submit at /f/[id] and view their own receipt — analytics is
  // creator-only because Seal only releases full plaintext to the cap holder.
  if (!isOwner) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Lock className="text-muted-foreground h-6 w-6" />
          <h2 className="font-semibold">You don&apos;t have access to these results</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Only the form&apos;s creator can view responses. Connected as{' '}
            <code className="font-mono">{shortAddr(account?.address ?? '')}</code> — creator is{' '}
            <code className="font-mono">{shortAddr(form.owner)}</code>. Switch wallets or open the
            public submit page instead.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <WalletButton />
            <Button asChild variant="outline" size="sm">
              <a href={`/f/${formId}`}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open public form
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const decryptedCount = Object.keys(decryptedById).length;
  const uniqueSubmitters = new Set(rows.map((r) => r.submitter)).size;
  const latestMs = rows.reduce((m, r) => Math.max(m, r.submittedAtMs), 0);
  const decryptedRows = rows
    .map((r) => decryptedById[r.submissionId])
    .filter((d): d is Record<string, unknown> => !!d);
  const completionPct =
    inputFields.length === 0 || decryptedRows.length === 0
      ? Number.NaN
      : (decryptedRows.reduce((sum, row) => {
          let answered = 0;
          for (const f of inputFields) {
            const v = row[f.id];
            const empty =
              v === null ||
              v === undefined ||
              (typeof v === 'string' && v.trim() === '') ||
              (Array.isArray(v) && v.length === 0);
            if (!empty) answered++;
          }
          return sum + (answered / inputFields.length) * 100;
        }, 0) / decryptedRows.length);
  const canDecrypt = !!activePackageId && !!originalPackageId;
  const isDecryptingAny = decryption.isSessionInitializing || !!decryption.pendingId;
  const timestamps = rows.map((r) => r.submittedAtMs);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{form.title}</h1>
            <FormStatusBadge
              status={deriveOnChainStatus({
                closed: form.closed,
                closesAtMs: form.closesAtMs,
                maxSubmissions: form.maxSubmissions,
                submissionCount: rows.length,
              })}
            />
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {rows.length} {rows.length === 1 ? 'response' : 'responses'} · creator{' '}
            <a
              href={suivisionUrl(network, 'account', form.owner)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
            >
              <code className="font-mono">{shortAddr(form.owner)}</code>
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeedResponsesButton
            formId={formId}
            fields={inputFields}
            seededCount={seededRows.length}
          />
          <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            Share
          </Button>
          <Button
            size="sm"
            onClick={() => void decryption.decryptAll(chainRows)}
            disabled={!canDecrypt || isDecryptingAny || chainRows.length === 0}
          >
            {isDecryptingAny ? (
              <Spinner className="mr-1.5 size-3.5" />
            ) : (
              <Lock className="mr-1.5 h-3.5 w-3.5" />
            )}
            Decrypt all
          </Button>
          <Button size="sm" variant="outline" onClick={handleCsv} disabled={rows.length === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void invalidateChain()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <ShareFormDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        formId={formId}
        formTitle={form.title}
      />

      <StatsSummary
        total={rows.length}
        decrypted={decryptedCount}
        uniqueSubmitters={uniqueSubmitters}
        latestMs={latestMs}
        completionPct={completionPct}
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as ResultsTab)}
        className="flex flex-col"
      >
        <TabsList className="rounded-none">
          <TabsTrigger value="summary" className="rounded-none">
            Summary
          </TabsTrigger>
          <TabsTrigger value="individual" className="rounded-none">
            Individual ({rows.length})
          </TabsTrigger>
          {ownerForm && (
            <TabsTrigger value="manage" className="rounded-none">
              Manage
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="summary" className="mt-4 flex flex-col gap-3">
          {rowsLoading && <div className="bg-muted h-24 animate-pulse rounded-xl" />}
          {rowsError && (
            <p className="text-destructive text-sm">Failed to load: {rowsError.message}</p>
          )}
          {!rowsLoading && rows.length === 0 ? (
            <EmptyResponses formId={formId} />
          ) : (
            <>
              <ResponseTimeline timestamps={timestamps} />
              {decryptedRows.length === 0 && rows.length > 0 ? (
                <DecryptCallout
                  total={rows.length}
                  canDecrypt={canDecrypt}
                  isDecrypting={isDecryptingAny}
                  onDecrypt={() => void decryption.decryptAll(rows)}
                />
              ) : (
                <AggregateCharts fields={inputFields} decryptedRows={decryptedRows} />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="individual" className="mt-4 flex flex-col gap-2">
          {rowsLoading && <div className="bg-muted h-24 animate-pulse rounded-xl" />}
          {!rowsLoading && rows.length === 0 && <EmptyResponses formId={formId} />}
          {rows.map((row) => (
            <SubmissionRowCard
              key={row.submissionId}
              row={row}
              decrypted={decryptedById[row.submissionId]}
              error={decryption.errorById[row.submissionId]}
              isExpanded={expandedId === row.submissionId}
              onToggle={() =>
                setExpandedId(expandedId === row.submissionId ? null : row.submissionId)
              }
              onDecrypt={() => void decryption.decryptOne(row)}
              isPending={decryption.pendingId === row.submissionId}
              canDecrypt={canDecrypt}
              fields={inputFields}
              network={network}
            />
          ))}
        </TabsContent>

        {ownerForm && (
          <TabsContent value="manage" className="mt-4">
            <ManagePanel form={ownerForm} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function EmptyResponses({ formId }: { formId: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-muted-foreground text-sm">
          No responses yet. Share <code className="font-mono">/f/{shortAddr(formId)}</code> to start
          collecting.
        </p>
      </CardContent>
    </Card>
  );
}

interface DecryptCalloutProps {
  total: number;
  canDecrypt: boolean;
  isDecrypting: boolean;
  onDecrypt: () => void;
}

function DecryptCallout({ total, canDecrypt, isDecrypting, onDecrypt }: DecryptCalloutProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-6">
        <div className="flex items-center gap-2">
          <Lock className="text-muted-foreground h-4 w-4" />
          <p className="text-sm font-medium">
            {total} encrypted {total === 1 ? 'response' : 'responses'}
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          Aggregates and per-question summaries appear after you decrypt. One wallet signature
          unlocks the full batch via your Seal session.
        </p>
        <Button onClick={onDecrypt} disabled={!canDecrypt || isDecrypting}>
          {isDecrypting ? (
            <Spinner className="mr-1.5 size-3.5" />
          ) : (
            <Lock className="mr-1.5 h-3.5 w-3.5" />
          )}
          Decrypt all
        </Button>
      </CardContent>
    </Card>
  );
}

interface ManagePanelProps {
  form: OnChainForm;
}

function ManagePanel({ form }: ManagePanelProps) {
  const closeForm = useCloseForm({ formId: form.formId, capId: form.capId });
  const [closeOpen, setCloseOpen] = useState(false);

  const handleCopy = async () => {
    if (await copyFormShareLink(form.formId)) toast.success('Share link copied');
  };

  const handleConfirmClose = async () => {
    if (await closeForm.close()) setCloseOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Button variant="outline" size="sm" asChild>
            <a href={`/f/${form.formId}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open public link
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy share link
          </Button>
          {!form.closed && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive ml-auto"
              onClick={() => setCloseOpen(true)}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Close form
            </Button>
          )}
        </CardContent>
      </Card>

      {form.accessMode === 3 && (
        <Card>
          <CardContent className="p-4">
            <WithdrawTreasuryButton form={form} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <DeployToWalrusSiteButton form={form} />
        </CardContent>
      </Card>

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close form?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{form.title}&quot; will stop accepting new submissions. Existing responses stay
              decryptable. This is on-chain and cannot be undone — re-opening requires a fresh
              publish.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closeForm.isClosing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={closeForm.isClosing}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmClose();
              }}
            >
              {closeForm.isClosing ? 'Closing…' : 'Close form'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
