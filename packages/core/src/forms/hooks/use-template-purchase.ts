'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useActivePackageId, useOriginalPackageId } from '../../sui/package-id';
import { buildCloneFreeTx, computeRoyaltyMist } from '../../sui/tx/clone-template';
import { buildClonePaidTx } from '../../sui/tx/clone-paid';
import { useExecuteTransaction } from '../../sui/use-execute-transaction';
import { useInvalidateChainQueries } from '../../sui/use-invalidate-chain';
import { formatSui } from '../lib/sui-amount';
import { useTemplateListing } from './use-template-listing';
import type { MarketplaceTemplate } from './use-marketplace-templates';

/**
 * Effective listing status, accounting for the case where a template was
 * published as 'free' and then later wrapped in a `TemplateListing` to flip
 * it into the multi-buyer paid flow.
 */
export type EffectiveStatus = MarketplaceTemplate['status'];

export interface UseTemplatePurchaseResult {
  /** Resolved listing status, after the paid-listing lookup folds 'free → paid'. */
  effectiveStatus: EffectiveStatus;
  /** Total cost (price + 10% royalty) in MIST, or null if pricing isn't resolved yet. */
  totalCostMist: bigint | null;
  /** Human-readable label for the action button. */
  actionLabel: string;
  /** True while the paid-listing lookup is still resolving. */
  isLoadingPrice: boolean;
  /** True iff the buyer can act (correct status + walform package + pricing resolved). */
  canAct: boolean;
  /** True while the action is in flight (sign + broadcast round-trip). */
  isActing: boolean;
  /** Fires the right action for the current `effectiveStatus`. */
  act: () => Promise<void>;
}

/**
 * Owns marketplace template clone/purchase flows. Two branches:
 *
 *   - **free**: `clone_free_and_share` — fresh Form for caller, no payment.
 *   - **paid**: `clone_paid_and_share` — multi-buyer pay-to-clone. Template
 *     stays alive after each clone; creator gets price, platform treasury
 *     gets 10% royalty (floor 0.05 SUI).
 *
 * The status fold (free → paid when a TemplateListing exists) ensures
 * templates whose creator added a listing post-publish surface the right
 * action even when the on-chain `status` field hasn't been refreshed.
 *
 * Every action is signed and paid by the buyer's connected wallet — the
 * paid branch additionally pays the seller's listed price + 10% royalty
 * via SUI coins selected by the tx builder.
 */
export function useTemplatePurchase(template: MarketplaceTemplate): UseTemplatePurchaseResult {
  const packageId = useActivePackageId();
  const originalPackageId = useOriginalPackageId();
  const { execute } = useExecuteTransaction();
  const invalidateChain = useInvalidateChainQueries();

  // Multi-buyer paid listing — present iff a TemplateListing was created post-publish.
  const paidListing = useTemplateListing(
    template.status === 'free' || template.status === 'paid' ? template.templateId : undefined,
  );
  const effectiveStatus: EffectiveStatus =
    template.status === 'free' && paidListing.listing ? 'paid' : template.status;

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
    if (effectiveStatus === 'free') return 'Clone free';
    if (effectiveStatus === 'paid') {
      if (paidListing.isLoading) return 'Loading price…';
      if (!paidListing.listing) return 'Price unavailable';
      return `Buy · ${formatSui(totalCostMist ?? 0n)} SUI`;
    }
    if (effectiveStatus === 'owned') return 'Not listed';
    return 'Unavailable';
  })();

  // Paid clones require both TransferPolicy (royalty config source) and
  // PlatformTreasury env vars. Disable up-front so the button never leads
  // to a guaranteed failure.
  const paidEnvReady =
    !!process.env.NEXT_PUBLIC_TRANSFER_POLICY_ID && !!process.env.NEXT_PUBLIC_PLATFORM_TREASURY_ID;
  const canAct =
    !!packageId &&
    !!originalPackageId &&
    !isActing &&
    (effectiveStatus === 'free'
      ? true
      : effectiveStatus === 'paid'
        ? !!paidListing.listing && paidEnvReady
        : false);

  const cloneTitle = template.title ? `${template.title} (copy)` : 'Untitled form';

  const act = async () => {
    if (!packageId) return;
    setIsActing(true);
    try {
      if (effectiveStatus === 'free') {
        await dispatchFreeClone({
          packageId,
          templateId: template.templateId,
          titleForNew: cloneTitle,
          execute,
          invalidateChain,
        });
        return;
      }
      if (effectiveStatus === 'paid' && paidListing.listing) {
        await dispatchPaidClone({
          packageId,
          template,
          listingId: paidListing.listing.listingId,
          priceMist: paidListing.listing.priceMist,
          titleForNew: cloneTitle,
          execute,
          invalidateChain,
        });
        return;
      }
      toast.error('Listing price unavailable — try again in a moment.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Action failed: ${msg}`);
      console.error(err);
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
    act,
  };
}

interface DispatchInput {
  packageId: string;
  execute: ReturnType<typeof useExecuteTransaction>['execute'];
  invalidateChain: ReturnType<typeof useInvalidateChainQueries>;
}

async function dispatchFreeClone(
  input: DispatchInput & { templateId: string; titleForNew: string },
): Promise<void> {
  const tx = buildCloneFreeTx({
    packageId: input.packageId,
    templateObjectId: input.templateId,
    titleForNew: input.titleForNew,
  });
  const { digest } = await input.execute({ transaction: tx });
  await input.invalidateChain(digest);
  toast.success('Cloned to your account — a new Form is live on-chain');
}

async function dispatchPaidClone(
  input: DispatchInput & {
    template: MarketplaceTemplate;
    listingId: string;
    priceMist: bigint;
    titleForNew: string;
  },
): Promise<void> {
  const transferPolicyId = process.env.NEXT_PUBLIC_TRANSFER_POLICY_ID;
  const platformTreasuryId = process.env.NEXT_PUBLIC_PLATFORM_TREASURY_ID;
  if (!transferPolicyId || !platformTreasuryId) {
    toast.error('TransferPolicy / Treasury env not configured.');
    return;
  }
  const royaltyMist = computeRoyaltyMist(input.priceMist);
  const total = input.priceMist + royaltyMist;
  const tx = buildClonePaidTx({
    packageId: input.packageId,
    templateId: input.template.templateId,
    listingId: input.listingId,
    platformTreasuryId,
    transferPolicyId,
    priceMist: input.priceMist,
    royaltyMist,
    titleForNew: input.titleForNew,
  });
  const { digest } = await input.execute({ transaction: tx });
  await input.invalidateChain(digest);
  toast.success(`Cloned — your wallet paid ${formatSui(total)} SUI + gas`);
}
