'use client';

import { useMemo, useState } from 'react';
import { Download, ExternalLink, Lock, RefreshCw } from 'lucide-react';
import { useCurrentAccount, useCurrentWallet } from '@mysten/dapp-kit';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Spinner } from '../../../ui/spinner';
import { useActivePackageId, useOriginalPackageId } from '../../../sui/package-id';
import { suivisionUrl } from '../../../sui/explorer';
import { useSuiClientContext } from '@mysten/dapp-kit';
import type { ExplorerNetwork } from '../../../sui/explorer';
import { useInvalidateChainQueries } from '../../../sui/use-invalidate-chain';
import { WalletButton } from '../../../sui/wallet-ui/WalletButton';
import { useFormOnChain, useFormSubmissions } from '../../hooks';
import { useSubmissionDecryption } from '../../hooks/use-submission-decryption';
import { isInputField } from '../../lib/field-types';
import { shortAddr } from '../../lib/format-address';
import { buildSubmissionsCsv, downloadCsv } from '../../lib/export-submissions-csv';
import type { FormField } from '../../../types';
import { AggregateCharts } from './AggregateCharts';
import { StatsSummary } from './StatsSummary';
import { SubmissionRowCard } from './SubmissionRowCard';

interface FormResultsViewProps {
  formId: string;
}

/**
 * Creator's Results dashboard. Lists every Submission for `formId`, decrypts
 * rows on demand via Seal, exports as CSV, and renders aggregates over
 * already-decrypted rows.
 *
 * Auth model: only the form's owner can decrypt other submitters' responses
 * (Seal policy passes for `caller == form.owner` OR `caller == submission.submitter`).
 * Non-owner connected wallets see ciphertext rows but Seal will reject decrypt.
 */
export function FormResultsView({ formId }: FormResultsViewProps) {
  const { isConnected } = useCurrentWallet();
  const account = useCurrentAccount();
  const { form, isLoading: formLoading } = useFormOnChain(formId);
  const { rows, isLoading: rowsLoading, error: rowsError } = useFormSubmissions(formId);
  const activePackageId = useActivePackageId();
  const originalPackageId = useOriginalPackageId();
  const invalidateChain = useInvalidateChainQueries();
  const { network: rawNetwork } = useSuiClientContext();
  const network: ExplorerNetwork =
    rawNetwork === 'mainnet' || rawNetwork === 'devnet' ? rawNetwork : 'testnet';

  const decryption = useSubmissionDecryption({ formId });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isOwner = !!account && !!form && account.address === form.owner;
  const inputFields = useMemo<FormField[]>(
    () => (form?.schema?.fields ?? []).filter(isInputField),
    [form?.schema],
  );

  const handleCsv = () => {
    if (!form) return;
    const csv = buildSubmissionsCsv({
      rows,
      decryptedById: decryption.decryptedById,
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

  // Plain computations — React Compiler memoizes these. Hoisting useMemo
  // here would violate rules-of-hooks (calls follow conditional early returns).
  const decryptedCount = Object.keys(decryption.decryptedById).length;
  const uniqueSubmitters = new Set(rows.map((r) => r.submitter)).size;
  const latestMs = rows.reduce((m, r) => Math.max(m, r.submittedAtMs), 0);
  const decryptedRows = rows
    .map((r) => decryption.decryptedById[r.submissionId])
    .filter((d): d is Record<string, unknown> => !!d);
  const canDecrypt = !!activePackageId && !!originalPackageId;
  const isDecryptingAny = decryption.isSessionInitializing || !!decryption.pendingId;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{form.title}</h1>
          <p className="text-muted-foreground text-xs">
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
          {!isOwner && (
            <p className="text-destructive mt-2 text-xs">
              Connected wallet is not the form&apos;s creator — Seal will reject decrypt requests
              for other submitters&apos; responses.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <WalletButton />
        </div>
      </div>

      <StatsSummary
        total={rows.length}
        decrypted={decryptedCount}
        uniqueSubmitters={uniqueSubmitters}
        latestMs={latestMs}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => void decryption.decryptAll(rows)}
          disabled={!canDecrypt || isDecryptingAny || rows.length === 0}
        >
          {isDecryptingAny ? (
            <Spinner className="mr-1.5 size-3.5" />
          ) : (
            <Lock className="mr-1.5 h-3.5 w-3.5" />
          )}
          Decrypt all
        </Button>
        <Button variant="outline" onClick={handleCsv} disabled={rows.length === 0}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
        <Button variant="ghost" onClick={() => void invalidateChain()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {rowsLoading && <div className="bg-muted h-24 animate-pulse rounded-xl" />}
      {rowsError && <p className="text-destructive text-sm">Failed to load: {rowsError.message}</p>}
      {!rowsLoading && rows.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No responses yet. Share <code className="font-mono">/f/{shortAddr(formId)}</code> to
              start collecting.
            </p>
          </CardContent>
        </Card>
      )}

      {decryptedRows.length > 0 && (
        <AggregateCharts fields={inputFields} decryptedRows={decryptedRows} />
      )}

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <SubmissionRowCard
            key={row.submissionId}
            row={row}
            decrypted={decryption.decryptedById[row.submissionId]}
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
      </div>
    </div>
  );
}
