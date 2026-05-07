'use client';

import { type ReactNode } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Lock } from 'lucide-react';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Spinner } from '../../../ui/spinner';
import { suivisionUrl, type ExplorerNetwork } from '../../../sui/explorer';
import { shortAddr } from '../../lib/format-address';
import { formatCell } from '../../lib/format-submission-cell';
import type { SubmissionRow } from '../../hooks/use-form-submissions';
import type { DecryptedRow } from '../../hooks/use-submission-decryption';
import type { FormField } from '../../../types';

interface SubmissionRowCardProps {
  row: SubmissionRow;
  decrypted: DecryptedRow | undefined;
  error: string | undefined;
  isExpanded: boolean;
  onToggle: () => void;
  onDecrypt: () => void;
  isPending: boolean;
  /** False when the active network has no walform package — disables Decrypt. */
  canDecrypt: boolean;
  fields: FormField[];
  network: ExplorerNetwork;
}

/**
 * One row in the Results dashboard. Pure presentation — decrypt is a callback
 * the parent wires to its `useSubmissionDecryption` hook.
 */
export function SubmissionRowCard({
  row,
  decrypted,
  error,
  isExpanded,
  onToggle,
  onDecrypt,
  isPending,
  canDecrypt,
  fields,
  network,
}: SubmissionRowCardProps) {
  return (
    <Card className="hover:bg-muted/30 transition-colors">
      <CardContent className="flex flex-col gap-2 p-3">
        <div
          className="flex cursor-pointer items-center gap-2 text-sm"
          onClick={onToggle}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onToggle();
          }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          <code className="font-mono text-xs">{shortAddr(row.submitter)}</code>
          <span className="text-muted-foreground text-xs">
            {new Date(row.submittedAtMs).toLocaleString()}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            {decrypted ? (
              <Badge variant="default">Decrypted</Badge>
            ) : error ? (
              <Badge variant="destructive">Error</Badge>
            ) : (
              <Badge variant="outline">Encrypted</Badge>
            )}
          </span>
        </div>
        {isExpanded && (
          <div className="flex flex-col gap-2 border-t pt-2 pl-5">
            {!decrypted && (
              <Button
                onClick={onDecrypt}
                disabled={isPending || !canDecrypt}
                className="self-start"
              >
                {isPending ? (
                  <Spinner className="mr-1.5 size-3" />
                ) : (
                  <Lock className="mr-1.5 h-3 w-3" />
                )}
                Decrypt
              </Button>
            )}
            {error && <p className="text-destructive text-xs">{error}</p>}
            {decrypted && (
              <dl className="flex flex-col gap-2 text-sm">
                {fields.map((f) => (
                  <div key={f.id} className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs font-medium">{f.label || f.id}</dt>
                    <dd className="break-words">{renderCell(f, decrypted[f.id])}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
              <a
                href={suivisionUrl(network, 'object', row.submissionId)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                <code className="font-mono">{shortAddr(row.submissionId)}</code>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function renderCell(field: FormField, value: unknown): ReactNode {
  if (field.type === 'file' && typeof value === 'string' && value.length > 0) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
      >
        Download attachment
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }
  const formatted = formatCell(value);
  if (!formatted) {
    return <span className="text-muted-foreground/60">— not answered —</span>;
  }
  return formatted;
}
