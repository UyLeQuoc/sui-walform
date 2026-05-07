import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';
import { createForm, newSettings, share as shareForm } from '../gen/walform/form';
import { placeAndList, publishTemplate } from '../gen/walform/template';

export interface BuildPublishMarketplaceTxInput {
  packageId: string;
  sender: string;
  title: string;
  schemaBytes: Uint8Array;
  themeBytes: Uint8Array;
  /** Template metadata. */
  template: {
    title: string;
    description: string;
    category: number;
    previewBlobId?: Uint8Array | null;
    tags: string[];
  };
  /** Undefined = Free (shared). Set = Paid (Kiosk listing at this mist price). */
  priceMist?: bigint;
}

/**
 * Single atomic PTB that publishes a form AND lists/shares it as a marketplace
 * template. Uses `form::create_form` (returns `(Form, FormOwnerCap)` by value)
 * so downstream commands can consume both halves. Flow:
 *
 *   1. new_settings(ACCESS_PUBLIC)
 *   2. (form, cap) = form::create_form(...)                    — by-value tuple
 *   3. template = template::publish_template(&cap, &form, ...)
 *   4a. Free: 0x2::transfer::public_share_object<FormTemplate>(template)
 *   4b. Paid: (kiosk, kioskCap) = 0x2::kiosk::new(), then template::place_and_list
 *       → 0x2::transfer::public_share_object<Kiosk>(kiosk)
 *       → 0x2::transfer::public_transfer<KioskOwnerCap>(kioskCap, sender)
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

  const templateTypeArg = `${input.packageId}::template::FormTemplate`;

  if (input.priceMist === undefined) {
    tx.moveCall({
      target: '0x2::transfer::public_share_object',
      typeArguments: [templateTypeArg],
      arguments: [templateArg],
    });
  } else {
    const kioskTuple = tx.moveCall({ target: '0x2::kiosk::new' }) as unknown as [
      TransactionObjectArgument,
      TransactionObjectArgument,
    ];
    const kiosk = kioskTuple[0];
    const kioskCap = kioskTuple[1];
    tx.add(
      placeAndList({
        package: input.packageId,
        arguments: {
          kiosk,
          kioskCap,
          template: templateArg,
          priceMist: input.priceMist,
        },
      }),
    );
    tx.moveCall({
      target: '0x2::transfer::public_share_object',
      typeArguments: ['0x2::kiosk::Kiosk'],
      arguments: [kiosk],
    });
    tx.transferObjects([kioskCap], input.sender);
  }

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
