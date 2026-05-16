import { Transaction } from '@mysten/sui/transactions';
import { purchaseTemplateOnly, recordFreeClone } from '../gen/walform/template';

export interface BuildPurchaseTemplateOnlyTxInput {
  packageId: string;
  templateId: string;
  listingId: string;
  platformTreasuryId: string;
  transferPolicyId: string;
  priceMist: bigint;
  royaltyMist: bigint;
}

/**
 * Buyer-side PTB for the preview-then-publish flow. Pays the creator + 10%
 * platform royalty + bumps `clone_count` + emits TemplateCloned (with
 * `new_form_id = 0x0` to flag "no Form yet — buyer is drafting"). The client
 * materialises an IndexedDB draft from the template's schema bytes; the user
 * publishes when ready.
 */
export function buildPurchaseTemplateOnlyTx(
  input: BuildPurchaseTemplateOnlyTxInput,
): Transaction {
  const tx = new Transaction();
  const [paymentCoin] = tx.splitCoins(tx.gas, [input.priceMist]);
  const [royaltyCoin] = tx.splitCoins(tx.gas, [input.royaltyMist]);
  tx.add(
    purchaseTemplateOnly({
      package: input.packageId,
      arguments: {
        template: input.templateId,
        listing: input.listingId,
        treasury: input.platformTreasuryId,
        policy: input.transferPolicyId,
        payment: paymentCoin,
        royaltyPayment: royaltyCoin,
      },
    }),
  );
  return tx;
}

export interface BuildRecordFreeCloneTxInput {
  packageId: string;
  templateId: string;
}

/**
 * Zero-payment bump of `template.clone_count`. Fired in the background after
 * a draft seeded from a free marketplace template is published — keeps the
 * marketplace popularity metric universal across free + paid.
 */
export function buildRecordFreeCloneTx(input: BuildRecordFreeCloneTxInput): Transaction {
  const tx = new Transaction();
  tx.add(
    recordFreeClone({
      package: input.packageId,
      arguments: { template: input.templateId },
    }),
  );
  return tx;
}
