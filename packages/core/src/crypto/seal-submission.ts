'use client';

import { Transaction } from '@mysten/sui/transactions';
import type { SealClient, SessionKey } from '@mysten/seal';
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { sealApproveReadSubmission } from '../sui/gen/walform/seal_policies';
import { buildSubmissionIdentity, generateSubmissionNonce, identityToHex } from './seal-identity';
import { getSealThreshold } from './seal-client';

export interface SealEncryptSubmissionInput {
  seal: SealClient;
  packageId: string;
  formObjectId: string;
  plaintext: Uint8Array;
}

export interface SealEncryptSubmissionOutput {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  identity: Uint8Array;
}

/**
 * Encrypt a submission body against the `seal_policies::seal_approve_read_submission`
 * policy. The caller must pass both `ciphertext` and `nonce` into the on-chain
 * `submission::submit` PTB so the on-chain identity matches the client identity.
 */
export async function sealEncryptSubmission(
  input: SealEncryptSubmissionInput,
): Promise<SealEncryptSubmissionOutput> {
  const nonce = generateSubmissionNonce();
  const identity = buildSubmissionIdentity(input.formObjectId, nonce);
  const { encryptedObject } = await input.seal.encrypt({
    threshold: getSealThreshold(),
    packageId: input.packageId,
    id: identityToHex(identity),
    data: input.plaintext,
  });
  return { ciphertext: encryptedObject, nonce, identity };
}

export interface SealDecryptSubmissionInput {
  seal: SealClient;
  sessionKey: SessionKey;
  client: SuiJsonRpcClient;
  packageId: string;
  formObjectId: string;
  submissionObjectId: string;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  /**
   * When set, the policy call routes through
   * `seal_approve_read_submission_with_reviewers` so addresses in the form's
   * reviewer set also pass the gate. Omit to fall back to the owner-or-
   * submitter check.
   */
  reviewersObjectId?: string;
}

/**
 * Decrypt a submission ciphertext by building the `seal_approve_read_submission`
 * PTB and passing it as `txBytes` to `seal.decrypt`. The Seal key servers call
 * the entry function to authorize key share release; success requires the
 * caller be the form creator OR the original submitter (or — when
 * `reviewersObjectId` is supplied — a member of the form's reviewer set).
 */
export async function sealDecryptSubmission(
  input: SealDecryptSubmissionInput,
): Promise<Uint8Array> {
  const identity = buildSubmissionIdentity(input.formObjectId, input.nonce);
  const tx = new Transaction();
  if (input.reviewersObjectId) {
    // Raw moveCall — codegen for this fn may not exist yet on older
    // checkouts, and we already accept that the new policy entry is only
    // callable post-2026-05-13 contract upgrade.
    tx.moveCall({
      target: `${input.packageId}::seal_policies::seal_approve_read_submission_with_reviewers`,
      arguments: [
        tx.pure.vector('u8', Array.from(identity)),
        tx.object(input.formObjectId),
        tx.object(input.submissionObjectId),
        tx.object(input.reviewersObjectId),
      ],
    });
  } else {
    tx.add(
      sealApproveReadSubmission({
        package: input.packageId,
        arguments: {
          id: Array.from(identity),
          form: input.formObjectId,
          submission: input.submissionObjectId,
        },
      }),
    );
  }
  const txBytes = await tx.build({ client: input.client, onlyTransactionKind: true });
  return input.seal.decrypt({
    data: input.ciphertext,
    sessionKey: input.sessionKey,
    txBytes,
  });
}
