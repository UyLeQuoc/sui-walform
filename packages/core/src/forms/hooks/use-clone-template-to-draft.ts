'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useActivePackageId } from '../../sui/package-id';
import {
  useActiveTransferPolicyId,
  useActivePlatformTreasuryId,
} from '../../sui/env-network';
import { buildPurchaseTemplateOnlyTx } from '../../sui/tx/purchase-template-only';
import { computeRoyaltyMist } from '../../sui/tx/clone-template';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';
import { formDb } from '../services/form-db';
import { createDraftFromTemplate } from '../lib/create-draft-from-template';
import { formatSui } from '../lib/sui-amount';
import { useTemplateListing } from './use-template-listing';
import { useTemplateSchema } from './use-template-schema';
import type { MarketplaceTemplate } from './use-marketplace-templates';
import type { EffectiveStatus } from './use-template-purchase';

export interface CloneStartResult {
  draftId: string;
  /** 'free' = no payment tx; 'paid' = `purchase_template_only` digest captured. */
  via: 'free' | 'paid';
  /** Set when `via === 'paid'`. */
  digest?: string;
}

export interface UseCloneTemplateToDraftResult {
  effectiveStatus: EffectiveStatus;
  /** Total cost (price + 10% royalty) for paid templates, null otherwise. */
  totalCostMist: bigint | null;
  /** Human-readable action label for the marketplace card button. */
  actionLabel: string;
  /** True while the paid-listing lookup is still resolving. */
  isLoadingPrice: boolean;
  /** True iff `start()` can succeed right now (env + listing + status ok). */
  canAct: boolean;
  /** True while the clone-to-draft flow is in flight. */
  isActing: boolean;
  /** Fires the right path; resolves to the new draft id on success. */
  start: () => Promise<CloneStartResult | null>;
}

/**
 * Materialises a marketplace template into an IndexedDB draft the user can
 * edit before publishing. Replaces the old "click → live shared Form" path.
 *
 *   - Free templates: fetch schema → write IDB draft → done. Zero on-chain
 *     activity until the user publishes.
 *   - Paid templates: build `purchase_template_only` PTB (pays creator + 10%
 *     royalty, bumps clone_count, mints NO Form) → wallet signs and pays →
 *     fetch schema → write IDB draft → done.
 *
 * Both paths set `StoredForm.sourceTemplate` for editor banner + Drafts pill.
 */
export function useCloneTemplateToDraft(
  template: MarketplaceTemplate,
): UseCloneTemplateToDraftResult {
  const packageId = useActivePackageId();
  const transferPolicyId = useActiveTransferPolicyId();
  const platformTreasuryId = useActivePlatformTreasuryId();
  const { execute } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();

  const paidListing = useTemplateListing(
    template.status === 'free' || template.status === 'paid' ? template.templateId : undefined,
  );
  const effectiveStatus: EffectiveStatus =
    template.status === 'free' && paidListing.listing ? 'paid' : template.status;

  // Lazy schema fetch — only enabled once the user is about to clone. We
  // can't gate on a "user clicked" flag from a hook return value, so we
  // always enable here; the request is dedup'd by React Query and only the
  // preview dialog typically pulls the same schema anyway.
  const schemaQuery = useTemplateSchema(template.templateId, true);

  const [isActing, setIsActing] = useState(false);

  const totalCostMist: bigint | null = (() => {
    if (effectiveStatus === 'paid' && paidListing.listing) {
      const price = paidListing.listing.priceMist;
      return price + computeRoyaltyMist(price);
    }
    return null;
  })();

  const isLoadingPrice = effectiveStatus === 'paid' && paidListing.isLoading;

  const actionLabel = (() => {
    if (effectiveStatus === 'free') return 'Clone';
    if (effectiveStatus === 'paid') {
      if (paidListing.isLoading) return 'Loading price…';
      if (!paidListing.listing) return 'Price unavailable';
      return `Buy · ${formatSui(totalCostMist ?? 0n)} SUI`;
    }
    if (effectiveStatus === 'owned') return 'Not listed';
    return 'Unavailable';
  })();

  const paidEnvReady = !!transferPolicyId && !!platformTreasuryId;
  const canAct =
    !!packageId &&
    !isActing &&
    (effectiveStatus === 'free'
      ? true
      : effectiveStatus === 'paid'
        ? !!paidListing.listing && paidEnvReady
        : false);

  const start = async (): Promise<CloneStartResult | null> => {
    if (!packageId) return null;
    setIsActing(true);
    try {
      // 1. Wait for schema. Stale = re-fetch.
      if (!schemaQuery.schema) {
        // Force a refetch by re-asking the client directly. The hook is bound
        // to react-query so we can wait on its loading state.
        if (schemaQuery.isLoading) {
          // Poll briefly — the hook is reactive but `start()` is imperative.
          for (let i = 0; i < 30; i++) {
            if (schemaQuery.schema || schemaQuery.error) break;
            await new Promise((r) => setTimeout(r, 200));
          }
        }
      }
      if (schemaQuery.schemaUnreadable) {
        toast.error('Template schema is sealed — cannot clone yet.');
        return null;
      }
      if (!schemaQuery.schema) {
        toast.error('Template schema is still loading — try again in a moment.');
        return null;
      }

      let digest: string | undefined;

      if (effectiveStatus === 'paid') {
        if (!paidListing.listing) {
          toast.error('Listing price unavailable — try again in a moment.');
          return null;
        }
        if (!transferPolicyId || !platformTreasuryId) {
          toast.error('TransferPolicy / Treasury not configured on this network.');
          return null;
        }
        const priceMist = paidListing.listing.priceMist;
        const royaltyMist = computeRoyaltyMist(priceMist);
        const tx = buildPurchaseTemplateOnlyTx({
          packageId,
          templateId: template.templateId,
          listingId: paidListing.listing.listingId,
          platformTreasuryId,
          transferPolicyId,
          priceMist,
          royaltyMist,
        });
        const result = await execute({ transaction: tx });
        digest = result.digest;
        await invalidateChain(digest);
      }

      // 2. Materialise the draft.
      const draft = createDraftFromTemplate({
        templateId: template.templateId,
        originalTitle: template.title,
        originalCreator: template.creator,
        templateSchema: schemaQuery.schema!,
        purchaseDigest: digest,
      });
      await formDb.save(draft);

      if (digest) {
        toast.success(`Purchased — opened in Drafts to edit before publish`);
      } else {
        toast.success('Cloned to your Drafts — edit and publish when ready');
      }
      return { draftId: draft.id, via: digest ? 'paid' : 'free', digest };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Clone failed: ${msg}`);
      console.error(err);
      return null;
    } finally {
      setIsActing(false);
    }
  };

  return {
    effectiveStatus,
    totalCostMist,
    actionLabel,
    isLoadingPrice,
    canAct,
    isActing,
    start,
  };
}
