/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/

/**
 * Seal approval policies — whitelist pattern (creator + submitter only).
 *
 * Seal identities are [namespace][inner_id] where the SDK prepends the
 * `originalPackageId` automatically; on-chain `seal_approve*` functions only see
 * the inner_id. We layout inner_id as:
 *
 * bytes 0..32 = form.id_address (32 BCS-encoded address bytes) bytes 32..48 =
 * submission.nonce (16 random bytes) total = 48 bytes
 *
 * See PRD §8.3 + §9.3, and Mysten's reference pattern at
 * https://github.com/MystenLabs/seal/blob/main/move/patterns/whitelist.move
 */

import { type Transaction } from '@mysten/sui/transactions';
import { normalizeMoveArguments, type RawTransactionArgument } from '../utils/index';
export interface SealApproveReadSubmissionArguments {
  id: RawTransactionArgument<Array<number>>;
  form: RawTransactionArgument<string>;
  submission: RawTransactionArgument<string>;
}
export interface SealApproveReadSubmissionOptions {
  package?: string;
  arguments:
    | SealApproveReadSubmissionArguments
    | [
        id: RawTransactionArgument<Array<number>>,
        form: RawTransactionArgument<string>,
        submission: RawTransactionArgument<string>,
      ];
}
/**
 * Called by Seal key servers when a client requests the decryption key shares for
 * a ciphertext. Succeeds only if the caller is either the form creator or the
 * original submitter, AND the identity is correctly bound to this (form,
 * submission) pair.
 */
export function sealApproveReadSubmission(options: SealApproveReadSubmissionOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = ['vector<u8>', null, null] satisfies (string | null)[];
  const parameterNames = ['id', 'form', 'submission'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'seal_policies',
      function: 'seal_approve_read_submission',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SealApproveSubmitArguments {
  id: RawTransactionArgument<Array<number>>;
  form: RawTransactionArgument<string>;
}
export interface SealApproveSubmitOptions {
  package?: string;
  arguments:
    | SealApproveSubmitArguments
    | [id: RawTransactionArgument<Array<number>>, form: RawTransactionArgument<string>];
}
/**
 * Called by Seal before encryption to validate that a new ciphertext for this form
 * is being minted by an address legitimately able to submit. We deliberately keep
 * this permissive (access-mode enforcement really happens in submission::submit)
 * so Seal's encrypt flow doesn't deadlock over edge cases like allowlist mutations
 * between encrypt and submit.
 */
export function sealApproveSubmit(options: SealApproveSubmitOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = ['vector<u8>', null] satisfies (string | null)[];
  const parameterNames = ['id', 'form'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'seal_policies',
      function: 'seal_approve_submit',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SealApproveReadFormSchemaArguments {
  id: RawTransactionArgument<Array<number>>;
  form: RawTransactionArgument<string>;
  allowlist: RawTransactionArgument<string>;
}
export interface SealApproveReadFormSchemaOptions {
  package?: string;
  arguments:
    | SealApproveReadFormSchemaArguments
    | [
        id: RawTransactionArgument<Array<number>>,
        form: RawTransactionArgument<string>,
        allowlist: RawTransactionArgument<string>,
      ];
}
/**
 * Schema-level decryption for Private forms (ACCESS_ALLOWLIST). The ciphertext
 * identity is the form's id bytes — callers who are the form owner OR a member of
 * the bound allowlist can decrypt. Public / token / paid access modes are not
 * supported on this path; they decrypt on submit-time via the respondent flow.
 */
export function sealApproveReadFormSchema(options: SealApproveReadFormSchemaOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = ['vector<u8>', null, null] satisfies (string | null)[];
  const parameterNames = ['id', 'form', 'allowlist'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'seal_policies',
      function: 'seal_approve_read_form_schema',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SealApproveReadTemplateSchemaArguments {
  id: RawTransactionArgument<Array<number>>;
  templateObj: RawTransactionArgument<string>;
}
export interface SealApproveReadTemplateSchemaOptions {
  package?: string;
  arguments:
    | SealApproveReadTemplateSchemaArguments
    | [id: RawTransactionArgument<Array<number>>, templateObj: RawTransactionArgument<string>];
}
/**
 * Schema-level decryption for Marketplace templates. The ciphertext identity is
 * the template's id bytes. Only the template creator can decrypt the ciphertext
 * pre-sale; buyers receive the decrypted schema client-side via
 * `template::purchase_template` / `clone_free`, which already hand them a fresh
 * plaintext Form.
 */
export function sealApproveReadTemplateSchema(options: SealApproveReadTemplateSchemaOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = ['vector<u8>', null] satisfies (string | null)[];
  const parameterNames = ['id', 'templateObj'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'seal_policies',
      function: 'seal_approve_read_template_schema',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EBadIdentityOptions {
  package?: string;
  arguments?: [];
}
export function eBadIdentity(options: EBadIdentityOptions = {}) {
  const packageAddress = options.package ?? 'walform';
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'seal_policies',
      function: 'e_bad_identity',
    });
}
export interface EUnauthorizedOptions {
  package?: string;
  arguments?: [];
}
export function eUnauthorized(options: EUnauthorizedOptions = {}) {
  const packageAddress = options.package ?? 'walform';
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'seal_policies',
      function: 'e_unauthorized',
    });
}
export interface EWrongFormOptions {
  package?: string;
  arguments?: [];
}
export function eWrongForm(options: EWrongFormOptions = {}) {
  const packageAddress = options.package ?? 'walform';
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'seal_policies',
      function: 'e_wrong_form',
    });
}
