'use client';

import { Transaction } from '@mysten/sui/transactions';
import type { SealClient, SessionKey } from '@mysten/seal';
import type { ClientWithCoreApi } from '@mysten/sui/client';
import { addressToBytes32, bytesToHex } from './seal-identity';
import { getSealThreshold } from './seal-client';

/**
 * Schema-level Seal helpers — v2, require the `seal_policies.move` upgrade
 * with `seal_approve_read_form_schema` + `seal_approve_read_template_schema`
 * entry fns. Gated behind `NEXT_PUBLIC_ENABLE_SEALED_SCHEMA=true` at the
 * caller site; there's no runtime feature check here.
 *
 * Encrypt identity = form/template object id bytes (32 bytes). The on-chain
 * policy reads only the prefix, so any identity ≥ 32 bytes starting with
 * the correct address works. We pad with the object-id itself for parity
 * with the 48-byte submission layout, keeping parsing uniform downstream.
 */

function buildSchemaIdentity(objectId: string): Uint8Array {
  return addressToBytes32(objectId);
}

export interface SealEncryptSchemaInput {
  seal: SealClient;
  packageId: string;
  /** Either the Form objectId (for Private forms) or the FormTemplate objectId (for Marketplace). */
  objectId: string;
  plaintext: Uint8Array;
}

export async function sealEncryptSchema(
  input: SealEncryptSchemaInput,
): Promise<{ ciphertext: Uint8Array }> {
  const identity = buildSchemaIdentity(input.objectId);
  const { encryptedObject } = await input.seal.encrypt({
    threshold: getSealThreshold(),
    packageId: input.packageId,
    id: bytesToHex(identity),
    data: input.plaintext,
  });
  return { ciphertext: encryptedObject };
}

export interface SealDecryptFormSchemaInput {
  seal: SealClient;
  sessionKey: SessionKey;
  client: ClientWithCoreApi;
  packageId: string;
  formObjectId: string;
  allowlistObjectId: string;
  ciphertext: Uint8Array;
}

export async function sealDecryptFormSchema(
  input: SealDecryptFormSchemaInput,
): Promise<Uint8Array> {
  const identity = buildSchemaIdentity(input.formObjectId);
  const tx = new Transaction();
  tx.moveCall({
    target: `${input.packageId}::seal_policies::seal_approve_read_form_schema`,
    arguments: [
      tx.pure.vector('u8', Array.from(identity)),
      tx.object(input.formObjectId),
      tx.object(input.allowlistObjectId),
    ],
  });
  const txBytes = await tx.build({ client: input.client, onlyTransactionKind: true });
  return input.seal.decrypt({
    data: input.ciphertext,
    sessionKey: input.sessionKey,
    txBytes,
  });
}

export interface SealDecryptTemplateSchemaInput {
  seal: SealClient;
  sessionKey: SessionKey;
  client: ClientWithCoreApi;
  packageId: string;
  templateObjectId: string;
  ciphertext: Uint8Array;
}

export async function sealDecryptTemplateSchema(
  input: SealDecryptTemplateSchemaInput,
): Promise<Uint8Array> {
  const identity = buildSchemaIdentity(input.templateObjectId);
  const tx = new Transaction();
  tx.moveCall({
    target: `${input.packageId}::seal_policies::seal_approve_read_template_schema`,
    arguments: [tx.pure.vector('u8', Array.from(identity)), tx.object(input.templateObjectId)],
  });
  const txBytes = await tx.build({ client: input.client, onlyTransactionKind: true });
  return input.seal.decrypt({
    data: input.ciphertext,
    sessionKey: input.sessionKey,
    txBytes,
  });
}
