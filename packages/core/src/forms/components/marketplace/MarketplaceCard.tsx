'use client';

import { useState } from 'react';
import { ExternalLink, Gift, ShoppingCart, Wallet } from 'lucide-react';
import { useCurrentWallet, useSuiClientContext } from '@mysten/dapp-kit';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Spinner } from '../../../ui/spinner';
import { suivisionUrl, type ExplorerNetwork } from '../../../sui/explorer';
import { WalletConnectModal } from '../../../sui/wallet-ui/WalletConnectModal';
import { useTemplatePurchase, type EffectiveStatus } from '../../hooks/use-template-purchase';
import type { MarketplaceTemplate } from '../../hooks/use-marketplace-templates';
import { shortAddr } from '../../lib/format-address';
import { StatusBadge } from './StatusBadge';

const CATEGORY_LABELS: Record<number, string> = {
  0: 'Survey',
  1: 'NPS',
  2: 'Event RSVP',
  3: 'Lead form',
  4: 'Other',
};

interface MarketplaceCardProps {
  template: MarketplaceTemplate;
}

export function MarketplaceCard({ template }: MarketplaceCardProps) {
  const { network } = useSuiClientContext();
  const net = (
    network === 'mainnet' || network === 'devnet' ? network : 'testnet'
  ) as ExplorerNetwork;
  const { isConnected } = useCurrentWallet();
  const { effectiveStatus, actionLabel, canAct, isActing, act } = useTemplatePurchase(template);
  const [connectOpen, setConnectOpen] = useState(false);

  const handleClick = () => {
    if (!isConnected) {
      setConnectOpen(true);
      return;
    }
    void act();
  };

  return (
    <>
      <Card>
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 min-w-0 flex-1 truncate text-sm font-semibold">
              {template.title}
            </h3>
            <StatusBadge status={effectiveStatus} />
          </div>
          {template.description && (
            <p className="text-muted-foreground line-clamp-3 text-xs">{template.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">
              {CATEGORY_LABELS[template.category] ?? `Category ${template.category}`}
            </Badge>
            <Badge variant="outline">{template.cloneCount} clones</Badge>
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline">
                #{tag}
              </Badge>
            ))}
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <span title={template.creator}>
              by <span className="font-mono">{shortAddr(template.creator)}</span>
            </span>
            <a
              href={suivisionUrl(net, 'object', template.templateId)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
            >
              <code className="font-mono">{shortAddr(template.templateId)}</code>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="mt-auto">
            <Button
              className="w-full"
              variant={
                effectiveStatus === 'paid' || effectiveStatus === 'kiosk' ? 'default' : 'secondary'
              }
              onClick={handleClick}
              disabled={!canAct}
            >
              <ActionIcon status={effectiveStatus} isActing={isActing} />
              {actionLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
      <WalletConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
    </>
  );
}

function ActionIcon({ status, isActing }: { status: EffectiveStatus; isActing: boolean }) {
  if (isActing) return <Spinner className="mr-1.5 size-4" />;
  if (status === 'paid' || status === 'kiosk')
    return <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />;
  if (status === 'free') return <Gift className="mr-1.5 h-3.5 w-3.5" />;
  return <Wallet className="mr-1.5 h-3.5 w-3.5" />;
}
