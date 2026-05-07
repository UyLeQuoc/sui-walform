import {
  Transaction,
  type TransactionArgument,
  type TransactionObjectArgument,
} from '@mysten/sui/transactions';
import { placeAndList, publishTemplate } from '../gen/walform/template';

export interface BuildPublishTemplateTxInput {
  packageId: string;
  /** The already-created (or being-created in same PTB) Form object id. */
  formObjectId: string | TransactionArgument;
  formOwnerCapId: string | TransactionArgument;
  title: string;
  description: string;
  /** Matches `template::FormTemplate.category` (u8). */
  category: number;
  previewBlobId?: Uint8Array | null;
  tags: string[];
  /** If set, list in a Kiosk at this price; else share as a free template. */
  priceMist?: bigint;
  /** Provide when the caller already has a Kiosk; otherwise a fresh one is created inline. */
  kioskId?: string;
  kioskOwnerCapId?: string;
  /** Address that should receive the fresh KioskOwnerCap if one is created. */
  sender?: string;
}

/**
 * Build a PTB that publishes a FormTemplate from an existing Form + cap. If a
 * `priceMist` is given, the template is placed + listed in a Kiosk (auto-created
 * when `kioskId`/`kioskOwnerCapId` aren't supplied); otherwise the template is
 * shared so that `template::clone_free` can be called by anyone.
 *
 * Can be composed into the same PTB that creates the Form by passing
 * `TransactionArgument` for `formObjectId`/`formOwnerCapId` — the caller is
 * responsible for building the `form::create_*` call first.
 */
export function buildPublishTemplateTx(input: BuildPublishTemplateTxInput): Transaction {
  const tx = new Transaction();
  const previewBytes = input.previewBlobId ? Array.from(input.previewBlobId) : null;

  const templateArg = tx.add(
    publishTemplate({
      package: input.packageId,
      arguments: {
        cap: input.formOwnerCapId as never,
        form: input.formObjectId as never,
        title: input.title,
        description: input.description,
        category: input.category,
        previewBlobId: previewBytes,
        tags: input.tags,
      },
    }),
  );

  const freeTemplateTypeArg = `${input.packageId}::template::FormTemplate`;

  if (input.priceMist === undefined) {
    tx.moveCall({
      target: '0x2::transfer::public_share_object',
      typeArguments: [freeTemplateTypeArg],
      arguments: [templateArg],
    });
    return tx;
  }

  if (input.kioskId && input.kioskOwnerCapId) {
    tx.add(
      placeAndList({
        package: input.packageId,
        arguments: {
          kiosk: input.kioskId,
          kioskCap: input.kioskOwnerCapId,
          template: templateArg,
          priceMist: input.priceMist,
        },
      }),
    );
    return tx;
  }

  // `0x2::kiosk::new` returns `(Kiosk, KioskOwnerCap)` — index into the
  // nested result so both halves are addressable as transaction arguments.
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
  if (input.sender) {
    tx.transferObjects([kioskCap], input.sender);
  }
  return tx;
}
