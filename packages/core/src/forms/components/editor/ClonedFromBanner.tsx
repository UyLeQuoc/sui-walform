'use client';

import { useState } from 'react';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { CheckCircle2, ExternalLink, Sparkles, X } from 'lucide-react';
import { Button } from '../../../ui/button';
import { suivisionUrl, type ExplorerNetwork } from '../../../sui/explorer';
import { formDb } from '../../services/form-db';
import { shortAddr } from '../../lib/format-address';
import type { StoredForm } from '../../../types';

interface ClonedFromBannerProps {
  formId: string;
  sourceTemplate: NonNullable<StoredForm['sourceTemplate']>;
}

/**
 * Editor banner shown when the draft was materialised from a marketplace
 * template (free clone or paid purchase). Surfaces provenance + a "Dismiss"
 * action that strips `sourceTemplate` from the IDB record.
 */
export function ClonedFromBanner({ formId, sourceTemplate }: ClonedFromBannerProps) {
  const { network } = useSuiClientContext();
  const explorer = (
    network === 'mainnet' || network === 'devnet' ? network : 'testnet'
  ) as ExplorerNetwork;
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = async () => {
    setDismissed(true);
    const current = await formDb.getById(formId);
    if (!current) return;
    const { sourceTemplate: _omit, ...rest } = current;
    await formDb.save({ ...rest, updatedAt: Date.now() });
  };

  const paid = !!sourceTemplate.purchaseDigest;

  return (
    <div className="border-primary/30 bg-primary/5 flex items-start gap-3 border-b px-4 py-2.5 text-sm">
      {paid ? (
        <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
      ) : (
        <Sparkles className="text-primary mt-0.5 size-4 shrink-0" />
      )}
      <div className="flex-1">
        <p className="text-foreground">
          {paid ? 'Purchased' : 'Cloned'} from{' '}
          <span className="font-medium">&ldquo;{sourceTemplate.originalTitle}&rdquo;</span> by{' '}
          <span className="font-mono text-xs">{shortAddr(sourceTemplate.originalCreator)}</span>
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Edit fields, branding, access, deadlines below — then click Publish when ready.
        </p>
      </div>
      <a
        href={suivisionUrl(explorer, 'object', sourceTemplate.templateId)}
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        Source template
        <ExternalLink className="size-3" />
      </a>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => void handleDismiss()}
        aria-label="Dismiss banner"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
