import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';
import { createForm, newSettings, share as shareForm } from '../gen/walform/form';
import { publishTemplate } from '../gen/walform/template';

export interface BuildPublishMarketplaceTxInput {
  packageId: string;
  sender: string;
  title: string;
  schemaBytes: Uint8Array;
  themeBytes: Uint8Array;
  template: {
    title: string;
    description: string;
    category: number;
    previewBlobId?: Uint8Array | null;
    tags: string[];
  };
}

/**
 * Atomic PTB: publish a Form + share it as a FREE marketplace template (anyone
 * can `clone_free_and_share`). Paid listings go through `buildPublishListingTx`
 * in `clone-paid.ts` (multi-buyer pay-to-clone via TemplateListing).
 *
 * Flow:
 *   1. new_settings(ACCESS_PUBLIC)
 *   2. (form, cap) = form::create_form(...)                    — by-value tuple
 *   3. template = template::publish_template(&cap, &form, ...)
 *   4. 0x2::transfer::public_share_object<FormTemplate>(template)
 *   5. form::share(form)                                       — Form goes shared
 *   6. 0x2::transfer::public_transfer<FormOwnerCap>(cap, sender)
 */
export function buildPublishMarketplaceTx(input: BuildPublishMarketplaceTxInput): Transaction {
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

  const createResult = tx.add(
    createForm({
      package: input.packageId,
      arguments: {
        title: input.title,
        schema: Array.from(input.schemaBytes),
        theme: Array.from(input.themeBytes),
        settings: settingsArg,
      },
    }),
  );
  const createTuple = createResult as unknown as [
    TransactionObjectArgument,
    TransactionObjectArgument,
  ];
  const formArg = createTuple[0];
  const capArg = createTuple[1];

  const templateArg = tx.add(
    publishTemplate({
      package: input.packageId,
      arguments: {
        cap: capArg,
        form: formArg,
        title: input.template.title,
        description: input.template.description,
        category: input.template.category,
        previewBlobId: input.template.previewBlobId
          ? Array.from(input.template.previewBlobId)
          : null,
        tags: input.template.tags,
      },
    }),
  );

  tx.moveCall({
    target: `${input.packageId}::voting::init_template_votes`,
    arguments: [templateArg],
  });

  tx.moveCall({
    target: '0x2::transfer::public_share_object',
    typeArguments: [`${input.packageId}::template::FormTemplate`],
    arguments: [templateArg],
  });

  tx.add(
    shareForm({
      package: input.packageId,
      arguments: {
        form: formArg,
      },
    }),
  );
  tx.transferObjects([capArg], input.sender);

  return tx;
}
