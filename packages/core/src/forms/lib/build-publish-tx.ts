import type { Transaction } from '@mysten/sui/transactions';
import { buildCreateFormTx } from '../../sui/tx/create-form';
import { buildPublishMarketplaceTx } from '../../sui/tx/publish-marketplace';
import { buildPublishListingTx } from '../../sui/tx/clone-paid';
import type { FormSchema } from '../../types';
import type { PublishOptions } from '../components/publish/PublishDialog';
import { suiToMist } from './sui-amount';

export interface BuildPublishTxInput {
  sender: string;
  packageId: string;
  schema: FormSchema;
  options: PublishOptions;
}

export interface BuildPublishTxResult {
  tx: Transaction;
  /**
   * True when the publish PTB writes a 1-byte placeholder schema. The caller
   * must follow up with `update_schema(ciphertext)` once the formObjectId is
   * known. See `useSealedSchemaFollowUp`.
   */
  needsSealedSchemaFollowUp: boolean;
}

const ACCESS_MODE: Record<'public' | 'private' | 'token' | 'paid', 0 | 1 | 2 | 3> = {
  public: 0,
  private: 1,
  token: 2,
  paid: 3,
};

function isSealedSchema(options: PublishOptions): boolean {
  return (
    options.mode === 'on-chain' &&
    options.access === 'private' &&
    process.env.NEXT_PUBLIC_ENABLE_SEALED_SCHEMA === 'true'
  );
}

function encodeSchema(schema: FormSchema, sealed: boolean): Uint8Array {
  // Sealed-schema flow ships a 1-byte placeholder; the real ciphertext is
  // written in a follow-up update_schema tx once the formObjectId is known.
  return sealed ? new Uint8Array([0]) : new TextEncoder().encode(JSON.stringify(schema));
}

function encodeTheme(schema: FormSchema): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      primaryColor: schema.settings.primaryColor,
      fontFamily: schema.settings.fontFamily,
      borderRadius: schema.settings.borderRadius,
    }),
  );
}

/**
 * Pure helper: turns a draft schema + publish options into the on-chain or
 * marketplace publish tx. No wallet, no I/O, no toasts — that lives in
 * `usePublishForm`.
 */
export function buildPublishTx(input: BuildPublishTxInput): BuildPublishTxResult {
  const { sender, packageId, schema, options } = input;
  const sealed = isSealedSchema(options);
  const schemaBytes = encodeSchema(schema, sealed);
  const themeBytes = encodeTheme(schema);
  const title = schema.title || 'Untitled form';

  if (options.mode === 'on-chain') {
    const tokenType =
      options.access === 'token' ? new TextEncoder().encode(options.tokenType) : undefined;
    const tx = buildCreateFormTx({
      packageId,
      sender,
      title,
      schemaBytes,
      themeBytes,
      settings: {
        accessMode: ACCESS_MODE[options.access],
        requiredTokenType: tokenType,
        requiredTokenAmount: options.access === 'token' ? options.tokenAmount : undefined,
        submissionFeeMist: options.access === 'paid' ? options.submissionFeeMist : undefined,
        maxSubmissions: BigInt(options.maxSubmissions),
        closesAtMs: options.closesAtMs ? BigInt(options.closesAtMs) : 0n,
      },
      allowlistMembers: options.access === 'private' ? options.allowlistAddresses : [],
    });
    return { tx, needsSealedSchemaFollowUp: sealed };
  }

  const templateMeta = {
    title: options.title,
    description: options.description,
    category: options.category,
    tags: options.tags,
    previewBlobId: null,
  };

  if (options.pricing === 'paid') {
    // Multi-buyer pay-to-clone flow — creates TemplateListing bound to a
    // shared FormTemplate. Each buyer calls clone_paid; template persists.
    const tx = buildPublishListingTx({
      packageId,
      sender,
      formTitle: title,
      schemaBytes,
      themeBytes,
      template: templateMeta,
      priceMist: suiToMist(options.priceSui),
    });
    return { tx, needsSealedSchemaFollowUp: false };
  }

  // Free template: share the FormTemplate directly so anyone can
  // `clone_free_and_share` from it.
  const tx = buildPublishMarketplaceTx({
    packageId,
    sender,
    title,
    schemaBytes,
    themeBytes,
    template: templateMeta,
  });
  return { tx, needsSealedSchemaFollowUp: false };
}
