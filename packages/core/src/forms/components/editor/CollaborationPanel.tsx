'use client';

import { Copy, Loader2, Users } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '../../../ui/button';
import { ScrollArea } from '../../../ui/scroll-area';
import { usePresence } from '../../hooks/use-presence';
import { peerLabel } from '../../lib/collab-identity';
import { withShareToken } from '../../lib/collab-share-token';
import { FormConflictError, formDb } from '../../services/form-db';
import { useFormBuilderStore } from '../../store/form-builder-store';
import { useCollab } from './CollabProvider';

export function CollaborationPanel() {
  const formId = useFormBuilderStore((s) => s.schema.id);
  const { awareness, status, enabled } = useCollab();
  const peers = usePresence(awareness);
  const [params, setParams] = useSearchParams();
  const [starting, setStarting] = useState(false);

  const token = params.get('t');
  const inviteLink =
    enabled && typeof window !== 'undefined' && formId && token
      ? `${window.location.origin}${window.location.pathname}?formId=${formId}&t=${token}`
      : '';

  // Enable sharing: ensure the draft has a share token (mint + persist once),
  // then drop the token into our own URL so we join our own room as host.
  const handleStart = async () => {
    if (!formId || starting) return;
    setStarting(true);
    try {
      const stored = await formDb.getById(formId);
      if (!stored) {
        toast.error('Save the draft before sharing');
        return;
      }
      let shareToken = stored.collab?.shareToken;
      if (!shareToken) {
        const now = Date.now();
        const updated = withShareToken(stored, now);
        shareToken = updated.collab?.shareToken;
        try {
          await formDb.save({ ...updated, updatedAt: now }, { expectedRev: stored.rev });
        } catch (err) {
          if (!(err instanceof FormConflictError)) throw err;
          // Another tab raced us — adopt whatever token now exists on disk.
          const fresh = await formDb.getById(formId);
          shareToken = fresh?.collab?.shareToken ?? shareToken;
        }
      }
      if (!shareToken) {
        toast.error('Could not start collaboration');
        return;
      }
      setParams({ formId, t: shareToken });
    } catch (err) {
      console.error('[collab] failed to start sharing', err);
      toast.error('Could not start collaboration');
    } finally {
      setStarting(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const statusLabel = !enabled
    ? 'Off'
    : status === 'synced'
      ? 'Live'
      : status === 'connecting'
        ? 'Connecting…'
        : 'Idle';

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 px-4 py-4">
        <div className="flex items-center gap-2">
          <span
            className={
              'h-2 w-2 rounded-full ' +
              (status === 'synced'
                ? 'bg-emerald-500'
                : enabled
                  ? 'bg-amber-500'
                  : 'bg-muted-foreground/40')
            }
          />
          <span className="text-sm font-medium">{statusLabel}</span>
          <span className="text-muted-foreground ml-auto flex items-center gap-1 text-xs">
            <Users className="h-3.5 w-3.5" />
            {peers.length + (enabled ? 1 : 0)}
          </span>
        </div>

        {enabled ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Invite link
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteLink}
                className="bg-muted/40 text-muted-foreground min-w-0 flex-1 truncate rounded-md border px-2 py-1.5 text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleCopy}
                disabled={!inviteLink}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-muted-foreground/80 text-xs leading-relaxed">
              Anyone with this link can co-edit — no wallet needed. The draft lives on the collab
              server, so collaborators can open it anytime, even while you&apos;re offline.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Button className="w-full" onClick={handleStart} disabled={starting || !formId}>
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  Start collaboration
                </>
              )}
            </Button>
            <p className="text-muted-foreground/80 text-xs leading-relaxed">
              Sharing opens a live session on the collab server and gives you an invite link. Until
              then this draft stays 100% local on your device.
            </p>
          </div>
        )}

        {enabled && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Editors
            </p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-sm">
                <span className="bg-foreground/70 h-2.5 w-2.5 rounded-full" />
                <span>You</span>
              </li>
              {peers.map((peer) => (
                <li key={peer.clientId} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: peer.user.color }}
                  />
                  <span className="truncate font-mono text-xs">
                    {peerLabel(peer.user.address, peer.user.name)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-muted-foreground/70 border-t pt-3 text-xs leading-relaxed">
          Edits merge live (CRDT) and persist on the server until you publish — publishing moves the
          form on-chain and ends the session. Anyone with the link can edit; finer access control is
          a later phase.
        </p>
      </div>
    </ScrollArea>
  );
}
