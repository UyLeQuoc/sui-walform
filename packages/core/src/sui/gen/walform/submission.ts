/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Submission — shared object recording one response to a Form. Holds the
 * Seal-encrypted body INLINE per PRD §7.4 (not Walrus). Built-in
 * size/deadline/cap/access-mode checks in submit().
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
const $moduleName = 'walform::submission';
export const Submission = new MoveStruct({ name: `${$moduleName}::Submission`, fields: {
        id: bcs.Address,
        form_id: bcs.Address,
        submitter: bcs.Address,
        /** Seal ciphertext. Size-capped. (See PRD §7.4 / §9.3.) */
        encrypted_body: bcs.vector(bcs.u8()),
        /**
         * Optional Walrus blob IDs for FILE_UPLOAD attachments. Empty for forms without
         * FILE_UPLOAD blocks.
         */
        file_blob_ids: bcs.vector(bcs.vector(bcs.u8())),
        /**
         * 16 random bytes — second half of the Seal identity (first half = form.id_bytes).
         * See seal_policies.move.
         */
        nonce: bcs.vector(bcs.u8()),
        submitted_at_ms: bcs.u64()
    } });
export interface SubmitArguments {
    form: RawTransactionArgument<string>;
    allowlist: RawTransactionArgument<string>;
    encryptedBody: RawTransactionArgument<Array<number>>;
    fileBlobIds: RawTransactionArgument<Array<Array<number>>>;
    nonce: RawTransactionArgument<Array<number>>;
}
export interface SubmitOptions {
    package?: string;
    arguments: SubmitArguments | [
        form: RawTransactionArgument<string>,
        allowlist: RawTransactionArgument<string>,
        encryptedBody: RawTransactionArgument<Array<number>>,
        fileBlobIds: RawTransactionArgument<Array<Array<number>>>,
        nonce: RawTransactionArgument<Array<number>>
    ];
}
/**
 * ACCESS_PUBLIC and ACCESS_ALLOWLIST paths. The allowlist argument is ignored when
 * form is PUBLIC; we still require a dummy allowlist object so the call shape
 * stays uniform on the client side. If you don't have a real allowlist, create a
 * throwaway one and pass it.
 */
export function submit(options: SubmitOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'vector<u8>',
        'vector<vector<u8>>',
        'vector<u8>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["form", "allowlist", "encryptedBody", "fileBlobIds", "nonce"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'submission',
        function: 'submit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubmitPaidArguments {
    form: RawTransactionArgument<string>;
    treasury: RawTransactionArgument<string>;
    feeCoin: RawTransactionArgument<string>;
    encryptedBody: RawTransactionArgument<Array<number>>;
    fileBlobIds: RawTransactionArgument<Array<Array<number>>>;
    nonce: RawTransactionArgument<Array<number>>;
}
export interface SubmitPaidOptions {
    package?: string;
    arguments: SubmitPaidArguments | [
        form: RawTransactionArgument<string>,
        treasury: RawTransactionArgument<string>,
        feeCoin: RawTransactionArgument<string>,
        encryptedBody: RawTransactionArgument<Array<number>>,
        fileBlobIds: RawTransactionArgument<Array<Array<number>>>,
        nonce: RawTransactionArgument<Array<number>>
    ];
}
/** ACCESS_PAID path. Accepts the fee coin and deposits it into the form's treasury. */
export function submitPaid(options: SubmitPaidOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        null,
        'vector<u8>',
        'vector<vector<u8>>',
        'vector<u8>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["form", "treasury", "feeCoin", "encryptedBody", "fileBlobIds", "nonce"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'submission',
        function: 'submit_paid',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ShareArguments {
    s: RawTransactionArgument<string>;
}
export interface ShareOptions {
    package?: string;
    arguments: ShareArguments | [
        s: RawTransactionArgument<string>
    ];
}
/**
 * Share a Submission as a shared object. Public so tests and external flows can
 * share from outside the declaring module.
 */
export function share(options: ShareOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'submission',
        function: 'share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubmitAndShareArguments {
    form: RawTransactionArgument<string>;
    allowlist: RawTransactionArgument<string>;
    encryptedBody: RawTransactionArgument<Array<number>>;
    fileBlobIds: RawTransactionArgument<Array<Array<number>>>;
    nonce: RawTransactionArgument<Array<number>>;
}
export interface SubmitAndShareOptions {
    package?: string;
    arguments: SubmitAndShareArguments | [
        form: RawTransactionArgument<string>,
        allowlist: RawTransactionArgument<string>,
        encryptedBody: RawTransactionArgument<Array<number>>,
        fileBlobIds: RawTransactionArgument<Array<Array<number>>>,
        nonce: RawTransactionArgument<Array<number>>
    ];
}
/** Thin wrappers that share-wrap the Submission for typical PTB usage. */
export function submitAndShare(options: SubmitAndShareOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'vector<u8>',
        'vector<vector<u8>>',
        'vector<u8>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["form", "allowlist", "encryptedBody", "fileBlobIds", "nonce"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'submission',
        function: 'submit_and_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubmitPaidAndShareArguments {
    form: RawTransactionArgument<string>;
    treasury: RawTransactionArgument<string>;
    feeCoin: RawTransactionArgument<string>;
    encryptedBody: RawTransactionArgument<Array<number>>;
    fileBlobIds: RawTransactionArgument<Array<Array<number>>>;
    nonce: RawTransactionArgument<Array<number>>;
}
export interface SubmitPaidAndShareOptions {
    package?: string;
    arguments: SubmitPaidAndShareArguments | [
        form: RawTransactionArgument<string>,
        treasury: RawTransactionArgument<string>,
        feeCoin: RawTransactionArgument<string>,
        encryptedBody: RawTransactionArgument<Array<number>>,
        fileBlobIds: RawTransactionArgument<Array<Array<number>>>,
        nonce: RawTransactionArgument<Array<number>>
    ];
}
export function submitPaidAndShare(options: SubmitPaidAndShareOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        null,
        'vector<u8>',
        'vector<vector<u8>>',
        'vector<u8>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["form", "treasury", "feeCoin", "encryptedBody", "fileBlobIds", "nonce"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'submission',
        function: 'submit_paid_and_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FormIdArguments {
    s: RawTransactionArgument<string>;
}
export interface FormIdOptions {
    package?: string;
    arguments: FormIdArguments | [
        s: RawTransactionArgument<string>
    ];
}
export function formId(options: FormIdOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'submission',
        function: 'form_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubmitterArguments {
    s: RawTransactionArgument<string>;
}
export interface SubmitterOptions {
    package?: string;
    arguments: SubmitterArguments | [
        s: RawTransactionArgument<string>
    ];
}
export function submitter(options: SubmitterOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'submission',
        function: 'submitter',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EncryptedBodyArguments {
    s: RawTransactionArgument<string>;
}
export interface EncryptedBodyOptions {
    package?: string;
    arguments: EncryptedBodyArguments | [
        s: RawTransactionArgument<string>
    ];
}
export function encryptedBody(options: EncryptedBodyOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'submission',
        function: 'encrypted_body',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FileBlobIdsArguments {
    s: RawTransactionArgument<string>;
}
export interface FileBlobIdsOptions {
    package?: string;
    arguments: FileBlobIdsArguments | [
        s: RawTransactionArgument<string>
    ];
}
export function fileBlobIds(options: FileBlobIdsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'submission',
        function: 'file_blob_ids',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface NonceArguments {
    s: RawTransactionArgument<string>;
}
export interface NonceOptions {
    package?: string;
    arguments: NonceArguments | [
        s: RawTransactionArgument<string>
    ];
}
export function nonce(options: NonceOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'submission',
        function: 'nonce',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubmittedAtMsArguments {
    s: RawTransactionArgument<string>;
}
export interface SubmittedAtMsOptions {
    package?: string;
    arguments: SubmittedAtMsArguments | [
        s: RawTransactionArgument<string>
    ];
}
export function submittedAtMs(options: SubmittedAtMsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'submission',
        function: 'submitted_at_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MaxEncryptedBodyBytesOptions {
    package?: string;
    arguments?: [
    ];
}
export function maxEncryptedBodyBytes(options: MaxEncryptedBodyBytesOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'submission',
        function: 'max_encrypted_body_bytes',
    });
}
export interface NonceBytesOptions {
    package?: string;
    arguments?: [
    ];
}
export function nonceBytes(options: NonceBytesOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'submission',
        function: 'nonce_bytes',
    });
}