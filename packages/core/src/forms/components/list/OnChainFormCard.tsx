'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useSuiClientContext } from '@mysten/dapp-kit';
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
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { useCloseForm } from '../../hooks/use-close-form';
import { copyFormShareLink } from '../../lib/share-link';
import type { OnChainForm } from '../../hooks/use-on-chain-forms';
import { DeployToWalrusSiteButton } from './DeployToWalrusSiteButton';
import { ExplorerLink } from './list-shared';
import { WithdrawTreasuryButton } from './WithdrawTreasuryButton';

const ACCESS_LABELS: Record<number, string> = {
  0: 'Public',
  1: 'Allowlist',
  2: 'Token-gated',
  3: 'Paid',
};

interface OnChainFormCardProps {
  form: OnChainForm;
}

export function OnChainFormCard({ form }: OnChainFormCardProps) {
  const { network } = useSuiClientContext();
  const closeForm = useCloseForm({ formId: form.formId, capId: form.capId });
  const [closeOpen, setCloseOpen] = useState(false);

  const deadlineLabel =
    form.closesAtMs === 0 ? 'No deadline' : new Date(form.closesAtMs).toLocaleString();

  const handleCopyShareLink = async () => {
    if (await copyFormShareLink(form.formId)) {
      toast.success('Share link copied');
    }
  };

  const handleConfirmClose = async () => {
    if (await closeForm.close()) setCloseOpen(false);
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 min-w-0 flex-1 truncate text-sm font-semibold">
            {form.title}
          </h3>
          {form.closed && <Badge variant="destructive">Closed</Badge>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{ACCESS_LABELS[form.accessMode] ?? 'Unknown'}</Badge>
          <Badge variant="outline">
            {form.submissionCount}/{form.maxSubmissions === 0 ? '∞' : form.maxSubmissions} subs
          </Badge>
          <Badge variant="outline">{deadlineLabel}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <ExplorerLink network={network} kind="object" id={form.formId} label="Form" />
          <ExplorerLink network={network} kind="object" id={form.capId} label="Cap" />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild variant="default">
            <a href={`/forms/${form.formId}/results`}>View responses</a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/f/${form.formId}`} target="_blank" rel="noopener noreferrer">
              Open public link
            </a>
          </Button>
          <Button variant="ghost" onClick={() => void handleCopyShareLink()}>
            Copy share link
          </Button>
          {!form.closed && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setCloseOpen(true)}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Close form
            </Button>
          )}
        </div>
        {form.accessMode === 3 && <WithdrawTreasuryButton form={form} />}
        <DeployToWalrusSiteButton form={form} />
      </CardContent>
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
    </Card>
  );
}
