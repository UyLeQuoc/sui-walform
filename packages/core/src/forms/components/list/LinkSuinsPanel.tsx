'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Transaction } from '@mysten/sui/transactions';
import { SuinsTransaction } from '@mysten/suins';
import { Button } from '../../../ui/button';
import { Spinner } from '../../../ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { useExecuteTransaction } from '../../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../../sui/use-invalidate-chain';
import { SUINS_WALRUS_SITE_KEY, useSuinsClient } from '../../../sui/suins';
import { useOwnedSuinsNames } from '../../hooks/use-owned-suins-names';

interface LinkSuinsPanelProps {
  /** The Walrus Site object id to link names to (the `walrus_site_id` value). */
  siteObjectId: string;
  /** Optional: callback fired with `<name>.wal.app` when a link succeeds. */
  onLinked?: (publicUrl: string, domainName: string) => void;
}

/**
 * SuiNS link sub-flow. Lists names the connected wallet owns on the active
 * network, lets them pick one, and calls `setUserData({ key: 'walrus_site_id', value: siteId })`
 * via a single PTB. Cost is ~0.005 SUI gas, no WAL.
 *
 * After linking, the Walrus Sites portal resolves `<name>.wal.app/` to the
 * given Site object id. No DNS, no CDN, no server — the portal reads
 * NameRecord on-chain and serves the matching Site.
 */
export function LinkSuinsPanel({ siteObjectId, onLinked }: LinkSuinsPanelProps) {
  const { names, isLoading, isReady } = useOwnedSuinsNames();
  const suinsClient = useSuinsClient();
  const { execute } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();

  const [selectedNft, setSelectedNft] = useState<string>('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkedDomain, setLinkedDomain] = useState<string | null>(null);

  const selectedName = useMemo(
    () => names.find((n) => n.nftId === selectedNft) ?? null,
    [names, selectedNft],
  );

  if (!isReady) {
    return (
      <div className="border-border bg-muted/30 rounded-md border px-3 py-2 text-xs">
        <p className="text-muted-foreground">
          SuiNS is testnet/mainnet only. Switch networks via the wallet dropdown.
        </p>
      </div>
    );
  }

  const handleLink = async () => {
    if (!selectedName || !suinsClient) return;
    setIsLinking(true);
    try {
      const tx = new Transaction();
      const suinsTx = new SuinsTransaction(suinsClient, tx);
      suinsTx.setUserData({
        nft: selectedName.nftId,
        key: SUINS_WALRUS_SITE_KEY,
        value: siteObjectId,
        isSubname: false,
      });
      const { digest } = await execute({ transaction: tx });
      await invalidateChain(digest);
      setLinkedDomain(selectedName.domainName);
      const publicUrl = `https://${selectedName.domainName.replace(/\.sui$/, '')}.wal.app`;
      onLinked?.(publicUrl, selectedName.domainName);
      toast.success(`Linked ${selectedName.domainName} → ${publicUrl}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Link failed: ${msg}`);
    } finally {
      setIsLinking(false);
    }
  };

  if (linkedDomain) {
    const subdomain = linkedDomain.replace(/\.sui$/, '');
    const publicUrl = `https://${subdomain}.wal.app`;
    return (
      <div className="border-primary/30 bg-primary/5 flex flex-col gap-2 rounded-md border px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <Check className="text-primary h-4 w-4" />
          <span className="font-medium">
            Linked <span className="font-mono">{linkedDomain}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {publicUrl}
          </a>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => {
              void navigator.clipboard
                .writeText(publicUrl)
                .then(() => toast.success('URL copied'))
                .catch(() => toast.error('Clipboard unavailable'));
            }}
          >
            <Copy className="mr-1 h-3 w-3" />
            Copy
          </Button>
        </div>
        <p className="text-muted-foreground text-[11px]">
          DNS propagates on-chain immediately — no waiting. May take a moment for the portal
          cache to refresh.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Spinner className="size-3" />
        Loading your SuiNS names…
      </div>
    );
  }

  if (names.length === 0) {
    return (
      <div className="border-border bg-muted/30 flex flex-col gap-2 rounded-md border px-3 py-2.5 text-xs">
        <p className="font-medium">No SuiNS names found.</p>
        <p className="text-muted-foreground">
          Register a name first — then come back here and link it to your site.
        </p>
        <a
          href="https://suins.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex items-center gap-1 self-start underline-offset-2 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Get a SuiNS name
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-medium">
        <Globe className="text-muted-foreground h-3.5 w-3.5" />
        Link a SuiNS name (≈ 0.005 SUI gas)
      </div>
      <div className="flex items-center gap-2">
        <Select value={selectedNft} onValueChange={setSelectedNft} disabled={isLinking}>
          <SelectTrigger className="h-8 flex-1 text-xs">
            <SelectValue placeholder="Pick a name…" />
          </SelectTrigger>
          <SelectContent>
            {names.map((n) => (
              <SelectItem key={n.nftId} value={n.nftId}>
                <span className="font-mono">{n.domainName}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => void handleLink()}
          disabled={!selectedNft || isLinking}
          className="h-8"
        >
          {isLinking ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Link
        </Button>
      </div>
      {selectedName && (
        <p className="text-muted-foreground text-[11px]">
          Linking will set <code className="font-mono">walrus_site_id</code> on{' '}
          <span className="font-mono">{selectedName.domainName}</span> → site object.
        </p>
      )}
    </div>
  );
}
