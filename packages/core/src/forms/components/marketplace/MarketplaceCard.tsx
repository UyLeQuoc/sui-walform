'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CalendarCheck,
  ClipboardList,
  ExternalLink,
  Eye,
  Gift,
  LayoutGrid,
  Mail,
  ShoppingCart,
  SmilePlus,
  Tag,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useCurrentWallet, useSuiClientContext } from '@mysten/dapp-kit';
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
import { Spinner } from '../../../ui/spinner';
import { cn } from '../../../lib/utils';
import { suivisionUrl, type ExplorerNetwork } from '../../../sui/explorer';
import { WalletConnectModal } from '../../../sui/wallet-ui/WalletConnectModal';
import { useCloneTemplateToDraft } from '../../hooks/use-clone-template-to-draft';
import type { EffectiveStatus } from '../../hooks/use-template-purchase';
import type { MarketplaceTemplate } from '../../hooks/use-marketplace-templates';
import type { TemplateVoteCounts } from '../../hooks/use-marketplace-votes';
import { computeRoyaltyMist } from '../../../sui/tx/clone-template';
import { useTemplateListing } from '../../hooks/use-template-listing';
import { formatSui } from '../../lib/sui-amount';
import { shortAddr } from '../../lib/format-address';
import { formsRoute } from '../../lib/routes';
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

const CATEGORY_STRIPE: Record<number, string> = {
  0: 'from-sky-500/30 via-sky-500/10 to-transparent',
  1: 'from-emerald-500/30 via-emerald-500/10 to-transparent',
  2: 'from-rose-500/30 via-rose-500/10 to-transparent',
  3: 'from-amber-500/30 via-amber-500/10 to-transparent',
  4: 'from-violet-500/30 via-violet-500/10 to-transparent',
};

const CATEGORY_ICON: Record<number, LucideIcon> = {
  0: ClipboardList,
  1: SmilePlus,
  2: CalendarCheck,
  3: Mail,
  4: LayoutGrid,
};

// Per-category icon tint — keeps the watermark visible on both light and
// dark backgrounds without overpowering the title underneath.
const CATEGORY_ACCENT: Record<number, { icon: string }> = {
  0: { icon: 'text-sky-500/25' },
  1: { icon: 'text-emerald-500/25' },
  2: { icon: 'text-rose-500/25' },
  3: { icon: 'text-amber-500/30' },
  4: { icon: 'text-violet-500/25' },
};

interface MarketplaceCardProps {
  template: MarketplaceTemplate;
  votes?: TemplateVoteCounts | null;
}

export function MarketplaceCard({ template, votes }: MarketplaceCardProps) {
  const router = useRouter();
  const { network } = useSuiClientContext();
  const explorer = (
    network === 'mainnet' || network === 'devnet' ? network : 'testnet'
  ) as ExplorerNetwork;
  const { isConnected } = useCurrentWallet();
  const clone = useCloneTemplateToDraft(template);
  const listing = useTemplateListing(
    clone.effectiveStatus === 'paid' ? template.templateId : undefined,
  );
  const [connectOpen, setConnectOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClick = () => {
    if (!isConnected) {
      setConnectOpen(true);
      return;
    }
    if (clone.effectiveStatus === 'paid') {
      setConfirmOpen(true);
      return;
    }
    void runStart();
  };

  const runStart = async () => {
    const result = await clone.start();
    if (result) router.push(formsRoute.edit(result.draftId));
  };

  const stripe = CATEGORY_STRIPE[template.category] ?? CATEGORY_STRIPE[4]!;
  const accent = CATEGORY_ACCENT[template.category] ?? CATEGORY_ACCENT[4]!;
  const CategoryIcon = CATEGORY_ICON[template.category] ?? CATEGORY_ICON[4]!;
  const categoryLabel = CATEGORY_LABELS[template.category] ?? `Category ${template.category}`;
  const ageLabel =
    template.createdAtMs > 0
      ? formatDistanceToNow(template.createdAtMs, { addSuffix: true })
      : 'unknown date';

  const priceMist = listing.listing?.priceMist ?? 0n;
  const royaltyMist = priceMist > 0n ? computeRoyaltyMist(priceMist) : 0n;
  const totalMist = priceMist + royaltyMist;

  return (
    <>
      <Card className="group flex flex-col pt-0 transition-shadow hover:shadow-lg">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="focus-visible:ring-ring relative block h-20 overflow-hidden rounded-t-3xl text-left focus-visible:ring-2 focus-visible:outline-none"
          aria-label={`Preview ${template.title}`}
        >
          <div aria-hidden className={cn('absolute inset-0 bg-gradient-to-br', stripe)} />
          <CategoryIcon
            aria-hidden
            className={cn(
              'pointer-events-none absolute -right-3 -bottom-4 h-24 w-24 rotate-[-12deg] transition-transform duration-300 group-hover:scale-110',
              accent.icon,
            )}
          />

          <div className="relative flex h-full items-center justify-between px-4">
            <span className="bg-background/70 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase backdrop-blur">
              <Tag className="h-2.5 w-2.5" />
              {categoryLabel}
            </span>
            <StatusBadge status={clone.effectiveStatus} />
          </div>
        </button>
        <CardContent className="flex flex-1 flex-col gap-3 px-5">
          <div className="flex flex-col gap-1.5">
            <h3 className="line-clamp-2 text-base font-semibold" title={template.title}>
              {template.title}
            </h3>
            {template.description && (
              <p className="text-muted-foreground line-clamp-2 text-xs">{template.description}</p>
            )}
          </div>

          {template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {template.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline">
                  #{tag}
                </Badge>
              ))}
              {template.tags.length > 3 && (
                <Badge variant="outline">+{template.tags.length - 3}</Badge>
              )}
            </div>
          )}

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span title={template.creator}>
              by <span className="font-mono">{shortAddr(template.creator)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {ageLabel}
            </span>
            <span
              className="inline-flex items-center gap-1"
              title={`${template.cloneCount} ${template.cloneCount === 1 ? 'clone' : 'clones'}`}
            >
              <Users className="h-3 w-3" />
              <span className="text-foreground tabular-nums">{template.cloneCount}</span>
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
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <VoteButtons votes={votes} size="sm" />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                title="Open the full template preview"
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Preview
              </Button>
              <Button
                size="sm"
                variant={clone.effectiveStatus === 'paid' ? 'default' : 'secondary'}
                onClick={handleClick}
                disabled={!clone.canAct && isConnected}
              >
                <ActionIcon status={clone.effectiveStatus} isActing={clone.isActing} />
                {clone.actionLabel}
              </Button>
            </div>
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
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buy template & edit before publishing</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground space-y-3 text-sm">
                <p>
                  You&apos;ll pay{' '}
                  <span className="text-foreground font-medium tabular-nums">
                    {formatSui(priceMist)} SUI
                  </span>{' '}
                  to the creator and{' '}
                  <span className="text-foreground font-medium tabular-nums">
                    {formatSui(royaltyMist)} SUI
                  </span>{' '}
                  as a 10% platform royalty —{' '}
                  <span className="text-foreground font-medium tabular-nums">
                    {formatSui(totalMist)} SUI
                  </span>{' '}
                  total + gas.
                </p>
                <p>
                  The template schema lands in your Drafts so you can edit fields, branding,
                  access mode, and deadlines before publishing. <strong>No refunds</strong> —
                  preview the template first if you&apos;re unsure.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clone.isActing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={clone.isActing}
              onClick={(e) => {
                e.preventDefault();
                setConfirmOpen(false);
                void runStart();
              }}
            >
              {clone.isActing ? 'Working…' : `Pay ${formatSui(totalMist)} SUI`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ActionIcon({ status, isActing }: { status: EffectiveStatus; isActing: boolean }) {
  if (isActing) return <Spinner className="mr-1.5 size-4" />;
  if (status === 'paid') return <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />;
  if (status === 'free') return <Gift className="mr-1.5 h-3.5 w-3.5" />;
  return <Wallet className="mr-1.5 h-3.5 w-3.5" />;
}
