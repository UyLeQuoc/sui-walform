'use client';

import { useState } from 'react';
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Spinner } from '../../../ui/spinner';
import { useFormAllowlist } from '../../hooks/use-form-allowlist';
import { useAllowlistActions } from '../../hooks/use-allowlist-actions';
import { shortAddr } from '../../lib/format-address';

interface AllowlistPanelProps {
  formId: string;
  /** FormOwnerCap id — required for every allowlist mutation (owner-only). */
  capId: string;
}

/**
 * Edit a Private form's submit allowlist after publish. Owner-only — every
 * add/remove is proven by the FormOwnerCap (enforced on-chain). Adding your
 * own address is also what lets the owner decrypt a sealed schema: the Seal
 * `seal_approve_read_form_schema` policy authorizes allowlist members.
 */
export function AllowlistPanel({ formId, capId }: AllowlistPanelProps) {
  const account = useCurrentAccount();
  const { allowlist, isLoading } = useFormAllowlist(formId);
  const { addMembers, removeMember, isMutating } = useAllowlistActions(
    allowlist?.allowlistId ?? null,
  );
  const [draft, setDraft] = useState('');

  const myAddr = account?.address ? normalizeSuiAddress(account.address) : null;
  const members = allowlist?.members ?? [];
  const meOnList = !!myAddr && members.includes(myAddr);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="bg-muted h-20 animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (!allowlist) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-1 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-muted-foreground h-4 w-4" />
            <h3 className="text-sm font-medium">Submit allowlist</h3>
          </div>
          <p className="text-muted-foreground text-xs">
            No allowlist found for this form. Allowlists exist only for Private (allowlist-gated)
            forms published with the current contract.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleAdd = async () => {
    const parts = draft.split(/[\s,;]+/).filter(Boolean);
    if (parts.length === 0) return;
    await addMembers(parts, capId);
    setDraft('');
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="text-muted-foreground h-4 w-4" />
          <h3 className="text-sm font-medium">Submit allowlist</h3>
          <span className="text-muted-foreground text-xs">
            {members.length} {members.length === 1 ? 'address' : 'addresses'}
          </span>
        </div>

        <p className="text-muted-foreground text-xs">
          Only these addresses can submit this Private form. Editable anytime — changes apply on the
          next submit. Add your own address to view (decrypt) the form yourself.
        </p>

        {myAddr && !meOnList && (
          <Button
            variant="outline"
            className="self-start"
            disabled={isMutating}
            onClick={() => void addMembers([myAddr], capId)}
          >
            {isMutating ? (
              <Spinner className="mr-1.5 size-3.5" />
            ) : (
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Add myself
          </Button>
        )}

        <div className="flex gap-1.5">
          <Input
            placeholder="0x… Sui address (paste several, separated by space or comma)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={isMutating}
            className="min-w-0 font-mono text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd();
            }}
          />
          <Button onClick={() => void handleAdd()} disabled={isMutating || !draft.trim()}>
            {isMutating ? (
              <Spinner className="mr-1.5 size-3.5" />
            ) : (
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Add
          </Button>
        </div>

        {members.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No addresses yet — nobody can submit until you add at least one.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {members.map((addr) => (
              <li
                key={addr}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-xs"
              >
                <code className="min-w-0 truncate font-mono">
                  {shortAddr(addr)}
                  {addr === myAddr && <span className="text-muted-foreground ml-1.5">(you)</span>}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 px-2"
                  onClick={() => void removeMember(addr, capId)}
                  disabled={isMutating}
                  title="Remove from allowlist"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
