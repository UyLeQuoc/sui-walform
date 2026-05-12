'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, UserPlus, Users } from 'lucide-react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Spinner } from '../../../ui/spinner';
import { useFormReviewers } from '../../hooks/use-form-reviewers';
import { shortAddr } from '../../lib/format-address';

interface ReviewersPanelProps {
  formId: string;
  /** Required for owner-gated actions (enable, remove). Omit for reviewer view. */
  capId?: string;
}

/**
 * Manage co-reviewers (judges, teammates) for a form. Adding is open to the
 * owner and any existing reviewer (peer-invite model). Removing is owner-
 * only (requires FormOwnerCap, enforced by Move).
 *
 * Auto-enable on first add: forms published before the reviewers upgrade
 * have no `FormReviewers` tracker. When the owner clicks Add on such a
 * form, we transparently fire `create_and_share` first, then chain the
 * actual add via a small useEffect (2 wallet signs, 1 UX action).
 */
export function ReviewersPanel({ formId, capId }: ReviewersPanelProps) {
  const account = useCurrentAccount();
  const reviewers = useFormReviewers(formId);
  const [draft, setDraft] = useState('');
  // Stash address while the tracker is being created. Ref (not state) so
  // the React 19 setState-in-effect lint doesn't trip — the indicator
  // derives from `reviewers.isMutating` instead.
  const pendingRef = useRef<string | null>(null);

  const myAddr = account?.address ? normalizeSuiAddress(account.address) : null;
  // Owner identity proven by both (a) the cap id passed in by the parent
  // and (b) the tracker's cached owner address matching the connected
  // wallet. Reviewer-only callers omit capId and never satisfy isOwner.
  const isOwner =
    !!myAddr && !!capId && (!reviewers.owner || reviewers.owner === myAddr);
  const isMember = !!myAddr && reviewers.members.includes(myAddr);
  const canAdd = isOwner || isMember;

  // Once the tracker pops in, flush any stashed add.
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    if (!reviewers.reviewersId) return;
    if (reviewers.isMutating) return;
    pendingRef.current = null;
    void reviewers.addReviewer(pending);
  }, [reviewers.reviewersId, reviewers.isMutating, reviewers]);

  if (reviewers.isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="bg-muted h-20 animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  const handleAdd = async () => {
    const addr = draft.trim();
    if (!addr || !canAdd) return;
    if (!reviewers.reviewersId) {
      // Old form: auto-create the tracker first. Owner-only (enable needs
      // the cap). The chained useEffect fires addReviewer once reviewersId
      // resolves.
      if (!capId) return;
      pendingRef.current = addr;
      setDraft('');
      await reviewers.enableReviewers(formId, capId);
      return;
    }
    await reviewers.addReviewer(addr);
    setDraft('');
  };

  const busy = reviewers.isMutating;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <Users className="text-muted-foreground h-4 w-4" />
          <h3 className="text-sm font-medium">Reviewers</h3>
          <span className="text-muted-foreground text-xs">
            {reviewers.members.length}{' '}
            {reviewers.members.length === 1 ? 'member' : 'members'}
          </span>
          {busy && !reviewers.reviewersId && (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs italic">
              <Spinner className="size-3" />
              Setting up tracker…
            </span>
          )}
        </div>

        <p className="text-muted-foreground text-xs">
          Reviewers can decrypt submissions and invite more reviewers. Only the owner can
          remove a reviewer.
        </p>

        {canAdd ? (
          <div className="flex gap-1.5">
            <Input
              placeholder="0x… Sui address"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={busy}
              className="font-mono text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAdd();
              }}
            />
            <Button onClick={() => void handleAdd()} disabled={busy || !draft.trim()}>
              {busy ? (
                <Spinner className="mr-1.5 size-3.5" />
              ) : (
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              )}
              Add
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs italic">
            Only the form owner or an existing reviewer can add new reviewers.
          </p>
        )}

        {reviewers.members.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {reviewers.reviewersId
              ? 'No reviewers yet — the owner is the only decrypter.'
              : 'Tracker initializes on first add — no extra step for you.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {reviewers.members.map((addr) => (
              <li
                key={addr}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-xs"
              >
                <code className="font-mono">{shortAddr(addr)}</code>
                {isOwner && capId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => void reviewers.removeReviewer(addr, capId)}
                    disabled={busy}
                    title="Owner-only: remove this reviewer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
