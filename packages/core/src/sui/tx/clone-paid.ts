import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';
import { newSettings } from '../gen/walform/form';

export interface BuildPublishListingTxInput {
  packageId: string;
  sender: string;
  /** Raw form schema JSON bytes. */
  schemaBytes: Uint8Array;
  themeBytes: Uint8Array;
  /** The Form title (mirrors draft title). */
  formTitle: string;
  template: {
    title: string;
    description: string;
    category: number;
    previewBlobId?: Uint8Array | null;
    tags: string[];
  };
  /** Listing price in MIST — must be > 0 for the paid flow. */
  priceMist: bigint;
}

/**
 * Atomic PTB: create a Form + publish it as a template + share the template +
 * create+share a TemplateListing at `priceMist`. Replaces the Kiosk path for
 * multi-buyer marketplace entries (Kiosk `purchase` would consume the
 * template after the first sale).
 */
export function buildPublishListingTx(input: BuildPublishListingTxInput): Transaction {
  const tx = new Transaction();

  const settingsArg = tx.add(
    newSettings({
      package: input.packageId,
      arguments: {
        accessMode: 0,
        allowlistId: null,
        requiredTokenType: [],
        requiredTokenAmount: 0n,
        submissionFeeMist: 0n,
        maxSubmissions: 0n,
        closesAtMs: 0n,
      },
    }),
  );

  // form::create_form → (Form, FormOwnerCap)
  const createResult = tx.moveCall({
    target: `${input.packageId}::form::create_form`,
    arguments: [
      tx.pure.string(input.formTitle || 'Untitled'),
      tx.pure.vector('u8', Array.from(input.schemaBytes)),
      tx.pure.vector('u8', Array.from(input.themeBytes)),
      settingsArg,
      tx.object.clock(),
    ],
  });
  const createTuple = createResult as unknown as [
    TransactionObjectArgument,
    TransactionObjectArgument,
  ];
  const formArg = createTuple[0];
  const capArg = createTuple[1];

  // template::publish_template → FormTemplate
  const previewBytes = input.template.previewBlobId
    ? Array.from(input.template.previewBlobId)
    : null;
  const templateArg = tx.moveCall({
    target: `${input.packageId}::template::publish_template`,
    arguments: [
      capArg,
      formArg,
      tx.pure.string(input.template.title),
      tx.pure.string(input.template.description),
      tx.pure.u8(input.template.category),
      previewBytes
        ? tx.pure.option('vector<u8>', previewBytes)
        : tx.pure.option('vector<u8>', null),
      tx.pure.vector('string', input.template.tags),
      tx.object.clock(),
    ],
  });

  // template::create_listing_and_share → lists template for sale at price
  tx.moveCall({
    target: `${input.packageId}::template::create_listing_and_share`,
    arguments: [templateArg, tx.pure.u64(input.priceMist)],
  });

  // voting::init_template_votes → creates the upvote/downvote tracker.
  // Creator-gated; ctx.sender matches template.creator here.
  tx.moveCall({
    target: `${input.packageId}::voting::init_template_votes`,
    arguments: [templateArg],
  });

  // Share the template as a shared object so clone_paid callers can take it by &mut.
  tx.moveCall({
    target: '0x2::transfer::public_share_object',
    typeArguments: [`${input.packageId}::template::FormTemplate`],
    arguments: [templateArg],
  });

  // Share the Form + hand the cap to the creator.
  tx.moveCall({
    target: `${input.packageId}::form::share`,
    arguments: [formArg],
  });
  tx.transferObjects([capArg], input.sender);

  return tx;
}

export interface BuildClonePaidTxInput {
  packageId: string;
  templateId: string;
  listingId: string;
  platformTreasuryId: string;
  transferPolicyId: string;
  priceMist: bigint;
  royaltyMist: bigint;
  titleForNew: string;
}

/**
 * Buyer-side PTB for the multi-buyer paid flow. Splits payment + royalty from
 * the gas coin (so it works under full sponsorship: admin pays both the
 * price-to-creator and royalty-to-treasury on the buyer's behalf). Template
 * stays alive for the next buyer.
 */
export function buildClonePaidTx(input: BuildClonePaidTxInput): Transaction {
  const tx = new Transaction();
  const settingsArg = tx.add(
    newSettings({
      package: input.packageId,
      arguments: {
        accessMode: 0,
        allowlistId: null,
        requiredTokenType: [],
        requiredTokenAmount: 0n,
        submissionFeeMist: 0n,
        maxSubmissions: 0n,
        closesAtMs: 0n,
      },
    }),
  );
  const [paymentCoin] = tx.splitCoins(tx.gas, [input.priceMist]);
  const [royaltyCoin] = tx.splitCoins(tx.gas, [input.royaltyMist]);
  tx.moveCall({
    target: `${input.packageId}::template::clone_paid_and_share`,
    arguments: [
      tx.object(input.templateId),
      tx.object(input.listingId),
      tx.object(input.platformTreasuryId),
      tx.object(input.transferPolicyId),
      paymentCoin,
      royaltyCoin,
      settingsArg,
      tx.pure.string(input.titleForNew),
      tx.object.clock(),
    ],
  });
  return tx;
}
