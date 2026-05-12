'use client';

import { useState } from 'react';
import { ExternalLink, Eye, Gift, ShoppingCart, Users, Wallet } from 'lucide-react';
import { useCurrentWallet, useSuiClientContext } from '@mysten/dapp-kit';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Spinner } from '../../../ui/spinner';
import { suivisionUrl, type ExplorerNetwork } from '../../../sui/explorer';
import { WalletConnectModal } from '../../../sui/wallet-ui/WalletConnectModal';
import { useTemplatePurchase, type EffectiveStatus } from '../../hooks/use-template-purchase';
import type { MarketplaceTemplate } from '../../hooks/use-marketplace-templates';
import type { TemplateVoteCounts } from '../../hooks/use-marketplace-votes';
import { shortAddr } from '../../lib/format-address';
import { MarketplacePreviewDialog } from './MarketplacePreviewDialog';
import { StatusBadge } from './StatusBadge';
import { VoteButtons } from './VoteButtons';

const CATEGORY_LABELS: Record<number, string> = {
  0: 'Survey',
  1: 'NPS',
  2: 'Event RSVP',
  3: 'Lead form',
  4: 'Other',
};

interface MarketplaceCardProps {
  template: MarketplaceTemplate;
  votes?: TemplateVoteCounts | null;
}

export function MarketplaceCard({ template, votes }: MarketplaceCardProps) {
  const { network } = useSuiClientContext();
  const explorer = (
    network === 'mainnet' || network === 'devnet' ? network : 'testnet'
  ) as ExplorerNetwork;
  const { isConnected } = useCurrentWallet();
  const { effectiveStatus, actionLabel, canAct, isActing, act } = useTemplatePurchase(template);
  const [connectOpen, setConnectOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleAction = () => {
    if (!isConnected) {
      setConnectOpen(true);
      return;
    }
    void act();
  };

  return (
    <>
      <Card className="hover:border-foreground/20 group transition-colors">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="line-clamp-1 min-w-0 flex-1 truncate text-sm font-semibold"
              title={template.title}
            >
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
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {template.cloneCount}
            </Badge>
            {template.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline">
                #{tag}
              </Badge>
            ))}
            {template.tags.length > 2 && (
              <Badge variant="outline">+{template.tags.length - 2}</Badge>
            )}
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span title={template.creator}>
              by <span className="font-mono">{shortAddr(template.creator)}</span>
            </span>
            <a
              href={suivisionUrl(explorer, 'object', template.templateId)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <code className="font-mono">{shortAddr(template.templateId)}</code>
              <ExternalLink className="h-3 w-3" />
            </a>
            <div className="ml-auto">
              <VoteButtons votes={votes} size="sm" />
            </div>
          </div>

          <div className="mt-auto flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setPreviewOpen(true)}
              title="Open the full template preview"
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              className="flex-1"
              variant={effectiveStatus === 'paid' ? 'default' : 'secondary'}
              onClick={handleAction}
              disabled={!canAct && isConnected}
            >
              <ActionIcon status={effectiveStatus} isActing={isActing} />
              {actionLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
      <WalletConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
      <MarketplacePreviewDialog
        template={template}
        votes={votes}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </>
  );
}

function ActionIcon({ status, isActing }: { status: EffectiveStatus; isActing: boolean }) {
  if (isActing) return <Spinner className="mr-1.5 size-4" />;
  if (status === 'paid') return <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />;
  if (status === 'free') return <Gift className="mr-1.5 h-3.5 w-3.5" />;
  return <Wallet className="mr-1.5 h-3.5 w-3.5" />;
}
