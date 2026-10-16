/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Referral links — added by a compatible upgrade.
 * 
 * A respondent who already submitted shares a link carrying their `Submission` id.
 * Someone submitting through it calls one of the wrappers below instead of
 * `submission::submit_and_share`: the new Submission is created exactly as before,
 * and the referral is recorded only after the referrer's Submission proves they
 * answered this same form (and isn't the new respondent themselves).
 * 
 * Recording happens only here, at creation, so a referral can't be added to an
 * existing Submission or recorded twice for one.
 * 
 * `ReferralRecorded` was introduced by this upgrade, so its type is tagged with
 * the package version that introduced it, not `originalPackageId`.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
const $moduleName = 'walform::referral';
export const ReferralRecorded = new MoveStruct({ name: `${$moduleName}::ReferralRecorded`, fields: {
        form_id: bcs.Address,
        /** The new Submission. */
        submission_id: bcs.Address,
        submitter: bcs.Address,
        /** Who shared the link — the referrer Submission's submitter. */
        referrer: bcs.Address,
        referrer_submission_id: bcs.Address,
        submitted_at_ms: bcs.u64()
    } });
export interface SubmitAndShareArguments {
    form: RawTransactionArgument<string>;
    allowlist: RawTransactionArgument<string>;
    referrer: RawTransactionArgument<string>;
    encryptedBody: RawTransactionArgument<Array<number>>;
    fileBlobIds: RawTransactionArgument<Array<Array<number>>>;
    nonce: RawTransactionArgument<Array<number>>;
}
export interface SubmitAndShareOptions {
    package?: string;
    arguments: SubmitAndShareArguments | [
        form: RawTransactionArgument<string>,
        allowlist: RawTransactionArgument<string>,
        referrer: RawTransactionArgument<string>,
        encryptedBody: RawTransactionArgument<Array<number>>,
        fileBlobIds: RawTransactionArgument<Array<Array<number>>>,
        nonce: RawTransactionArgument<Array<number>>
    ];
}
/**
 * `submission::submit_and_share` (public / allowlist / token forms), crediting
 * `referrer`.
 */
export function submitAndShare(options: SubmitAndShareOptions) {
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
    const parameterNames = ["form", "allowlist", "referrer", "encryptedBody", "fileBlobIds", "nonce"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral',
        function: 'submit_and_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubmitPaidAndShareArguments {
    form: RawTransactionArgument<string>;
    treasury: RawTransactionArgument<string>;
    feeCoin: RawTransactionArgument<string>;
    referrer: RawTransactionArgument<string>;
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
        referrer: RawTransactionArgument<string>,
        encryptedBody: RawTransactionArgument<Array<number>>,
        fileBlobIds: RawTransactionArgument<Array<Array<number>>>,
        nonce: RawTransactionArgument<Array<number>>
    ];
}
/** `submission::submit_paid_and_share` (paid forms), crediting `referrer`. */
export function submitPaidAndShare(options: SubmitPaidAndShareOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'vector<u8>',
        'vector<vector<u8>>',
        'vector<u8>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["form", "treasury", "feeCoin", "referrer", "encryptedBody", "fileBlobIds", "nonce"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral',
        function: 'submit_paid_and_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}