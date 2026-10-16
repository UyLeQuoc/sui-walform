'use client';

import { useId, useState } from 'react';
import { Database } from 'lucide-react';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '../../../ui/input-group';
import { Skeleton } from '../../../ui/skeleton';
import { Spinner } from '../../../ui/spinner';
import {
  useExtendFormStorage,
  useFormStorage,
  type FormStorageSnapshot,
} from '../../hooks/use-form-storage';
import { formatAmountShort, formatWal } from '../../lib/sui-amount';
import { daysUntilEpoch, expirySummary, extensionPlan } from '../../lib/walrus-storage';
import { StatTile } from './StatTile';

/** At or below this many days to the earliest expiry, the panel flags it. */
const EXPIRING_SOON_DAYS = 3;

/**
 * Keeps a form's responses on Walrus. Each submission's blobs are SharedBlobs,
 * so the creator can extend them without the respondent — whoever paid to
 * store them (respondent or sponsor pool). Expired blobs can't be revived.
 */
export function FormStoragePanel({ formId }: { formId: string }) {
  const storage = useFormStorage(formId);
  if (storage.status === 'unavailable') return null;

  const snapshot = storage.status === 'success' ? storage.snapshot : null;
  const summary = snapshot && expirySummary(snapshot.blobs, snapshot.currentEpoch);
  const daysLeft =
    snapshot && summary
      ? daysUntilEpoch(summary.earliestEpoch, snapshot.currentEpoch, snapshot.epochDurationMs)
      : null;
  const expiringSoon = daysLeft !== null && daysLeft <= EXPIRING_SOON_DAYS;

  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-5 p-5">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Database className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">Walrus storage</h3>
              {expiringSoon && (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                >
                  Expiring soon
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Responses are stored on Walrus for a fixed number of epochs. Extend them before they
              expire - anyone can, no matter who paid to store them.
            </p>
          </div>
        </div>

        {storage.status === 'loading' && <Skeleton className="h-28 w-full rounded-lg" />}
        {storage.status === 'error' && (
          <p className="text-destructive text-xs">
            Couldn&apos;t load storage: {storage.error.message}
          </p>
        )}
        {snapshot && !summary && snapshot.respondentOwned === 0 && (
          <p className="bg-muted/50 text-muted-foreground rounded-lg px-3 py-2.5 text-xs">
            No responses on Walrus yet.
          </p>
        )}
        {snapshot && summary && daysLeft !== null && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatTile label="Stored files" value={String(snapshot.blobs.length)} />
              <StatTile
                label="Earliest expiry"
                value={
                  summary.earliestEpoch > snapshot.currentEpoch ? `≈ ${daysLeft} days` : 'Expired'
                }
                hint={`epoch ${summary.earliestEpoch} (now ${snapshot.currentEpoch})`}
                warn={expiringSoon}
              />
              <StatTile
                label="Latest expiry"
                value={`≈ ${daysUntilEpoch(summary.latestEpoch, snapshot.currentEpoch, snapshot.epochDurationMs)} days`}
                hint={`epoch ${summary.latestEpoch}`}
              />
            </div>
            <ExtendControls snapshot={snapshot} />
          </>
        )}
        {snapshot && snapshot.respondentOwned > 0 && (
          <p className="bg-muted/50 text-muted-foreground rounded-lg px-3 py-2.5 text-xs">
            {snapshot.respondentOwned} older response
            {snapshot.respondentOwned === 1 ? ' is' : 's are'} stored in the respondent&apos;s own
            wallet, so only they can extend {snapshot.respondentOwned === 1 ? 'it' : 'them'}. New
            responses can all be extended here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ExtendControls({ snapshot }: { snapshot: FormStorageSnapshot }) {
  const extend = useExtendFormStorage();
  const [epochs, setEpochs] = useState('10');
  const epochsId = useId();

  const n = Number.parseInt(epochs, 10);
  const plan = extensionPlan(snapshot, Number.isFinite(n) ? n : 0);
  const files = snapshot.blobs.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={epochsId} className="sr-only">
          Epochs to add
        </label>
        <InputGroup className="w-36">
          <InputGroupInput
            id={epochsId}
            type="number"
            min="1"
            max={snapshot.maxEpochsAhead}
            value={epochs}
            onChange={(e) => setEpochs(e.target.value)}
            className="tabular-nums"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>epochs</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        <Button
          size="sm"
          title={`${formatWal(plan.totalTopUpFrost)} WAL`}
          onClick={() => extend.execute(snapshot, n)}
          disabled={extend.isPending || plan.items.length === 0}
        >
          {extend.isPending && <Spinner className="mr-1.5 size-3.5" />}
          Extend {plan.items.length === files ? 'all' : plan.items.length} ·{' '}
          {formatAmountShort(plan.totalTopUpFrost, 5)} WAL
        </Button>
        <span className="text-muted-foreground text-[11px]">Paid from your wallet.</span>
      </div>
      {plan.skipped > 0 && (
        <p className="text-muted-foreground text-xs">
          {plan.skipped} file{plan.skipped === 1 ? '' : 's'} skipped: expired, or past Walrus&apos;s{' '}
          {snapshot.maxEpochsAhead}-epoch limit.
        </p>
      )}
    </div>
  );
}
