'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Eye, FileWarning, Gift, ShoppingCart, Wallet } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Spinner } from '../../../ui/spinner';
import { suivisionUrl, type ExplorerNetwork } from '../../../sui/explorer';
import { WalletConnectModal } from '../../../sui/wallet-ui/WalletConnectModal';
import { useCloneTemplateToDraft } from '../../hooks/use-clone-template-to-draft';
import type { EffectiveStatus } from '../../hooks/use-template-purchase';
import { useTemplateListing } from '../../hooks/use-template-listing';
import { useTemplateSchema } from '../../hooks/use-template-schema';
import { computeRoyaltyMist } from '../../../sui/tx/clone-template';
import type { MarketplaceTemplate } from '../../hooks/use-marketplace-templates';
import type { TemplateVoteCounts } from '../../hooks/use-marketplace-votes';
import { formatSui } from '../../lib/sui-amount';
import { shortAddr } from '../../lib/format-address';
import { buildFormAreaStyle } from '../../lib/form-appearance';
import { getFormFont } from '../../lib/form-fonts';
import { formsRoute } from '../../lib/routes';
import { CoverImageView } from '../editor/CoverImage';
import { FormPreview } from '../preview/FormPreview';
import type { FormSchema } from '../../../types';
import { StatusBadge } from './StatusBadge';
import { VoteButtons } from './VoteButtons';

const CATEGORY_LABELS: Record<number, string> = {
  0: 'Survey',
  1: 'NPS',
  2: 'Event RSVP',
  3: 'Lead form',
  4: 'Other',
};

interface MarketplacePreviewDialogProps {
  template: MarketplaceTemplate;
  votes?: TemplateVoteCounts | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarketplacePreviewDialog({
  template,
  votes,
  open,
  onOpenChange,
}: MarketplacePreviewDialogProps) {
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
  const { schema, schemaUnreadable, isLoading, error } = useTemplateSchema(
    template.templateId,
    open,
  );
  const [connectOpen, setConnectOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const priceMist = listing.listing?.priceMist ?? 0n;
  const royaltyMist = priceMist > 0n ? computeRoyaltyMist(priceMist) : 0n;
  const totalMist = priceMist + royaltyMist;

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
    if (result) {
      onOpenChange(false);
      router.push(formsRoute.edit(result.draftId));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b p-6 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate">{template.title}</DialogTitle>
                {template.description && (
                  <DialogDescription className="mt-1.5 line-clamp-2">
                    {template.description}
                  </DialogDescription>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <VoteButtons votes={votes} size="md" />
                <StatusBadge status={clone.effectiveStatus} />
              </div>
            </div>
            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
              <Badge variant="outline">
                {CATEGORY_LABELS[template.category] ?? `Category ${template.category}`}
              </Badge>
              <Badge variant="outline">{template.cloneCount} clones</Badge>
              {template.tags.slice(0, 5).map((tag) => (
                <Badge key={tag} variant="outline">
                  #{tag}
                </Badge>
              ))}
              <span title={template.creator}>
                by <span className="font-mono">{shortAddr(template.creator)}</span>
              </span>
              <a
                href={suivisionUrl(explorer, 'object', template.templateId)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                <code className="font-mono">{shortAddr(template.templateId)}</code>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </DialogHeader>

          <PreviewBody
            isLoading={isLoading}
            error={error}
            schemaUnreadable={schemaUnreadable}
            schema={schema}
          />

          <DialogFooter className="bg-background border-t p-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              variant={clone.effectiveStatus === 'paid' ? 'default' : 'secondary'}
              onClick={handleClick}
              disabled={!clone.canAct && isConnected}
            >
              <ActionIcon status={clone.effectiveStatus} isActing={clone.isActing} />
              {clone.actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WalletConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
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

interface PreviewBodyProps {
  isLoading: boolean;
  error: Error | null;
  schemaUnreadable: boolean;
  schema: FormSchema | null;
}

function PreviewBody({ isLoading, error, schemaUnreadable, schema }: PreviewBodyProps) {
  const formAreaStyle = useMemo(() => {
    if (!schema) return undefined;
    const font = getFormFont(schema.settings.fontFamily);
    return buildFormAreaStyle(
      font.fontFamily,
      schema.settings.borderRadius ?? 4,
      schema.settings.primaryColor ?? 'default',
    );
  }, [schema]);

  if (isLoading) {
    return (
      <div className="bg-secondary/40 flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center">
        <Spinner className="size-5" />
        <p className="text-muted-foreground text-sm">Loading preview…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-secondary/40 flex-1 py-20 text-center">
        <p className="text-destructive text-sm">Failed to load template: {error.message}</p>
      </div>
    );
  }
  if (schemaUnreadable) {
    return (
      <div className="bg-secondary/40 text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center text-sm">
        <FileWarning className="h-6 w-6" />
        <p>Template schema is encrypted or corrupted — preview not available before clone.</p>
      </div>
    );
  }
  if (!schema) {
    return (
      <div className="bg-secondary/40 text-muted-foreground flex-1 py-20 text-center text-sm">
        No schema returned.
      </div>
    );
  }

  return (
    <div className="bg-secondary/40 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center" style={formAreaStyle}>
        {schema.coverImage && <CoverImageView src={schema.coverImage} className="mb-4" />}
        <div
          className="bg-card pointer-events-none w-full rounded-xl border shadow-xl select-none [&_button[type=submit]]:hidden"
          aria-label="Template preview (read-only)"
        >
          <FormPreview schema={schema} />
        </div>
        <p className="text-muted-foreground/80 mt-3 text-[11px]">
          This is a preview — submit is disabled until you clone the template.
        </p>
      </div>
    </div>
  );
}

function ActionIcon({ status, isActing }: { status: EffectiveStatus; isActing: boolean }) {
  if (isActing) return <Spinner className="mr-1.5 size-4" />;
  if (status === 'paid') return <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />;
  if (status === 'free') return <Gift className="mr-1.5 h-3.5 w-3.5" />;
  if (status === 'owned') return <Eye className="mr-1.5 h-3.5 w-3.5" />;
  return <Wallet className="mr-1.5 h-3.5 w-3.5" />;
}
