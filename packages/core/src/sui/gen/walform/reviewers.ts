/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * FormReviewers — one shared set of addresses per Form that can decrypt
 * submissions alongside the form's owner. Used to share decrypt rights with
 * hackathon judges, co-admins, or trusted teammates without giving up the
 * FormOwnerCap (which still gates writes like close/withdraw/update).
 * 
 * Permission model:
 * 
 * - Owner OR any existing reviewer can ADD a new reviewer.
 * - ONLY the owner (via FormOwnerCap) can REMOVE a reviewer.
 * - Reviewers can decrypt submissions via
 *   `seal_policies::seal_approve_read_submission_with_reviewers`.
 * - Reviewers do NOT inherit owner write rights (close, treasury, schema update,
 *   etc.) — those stay cap-gated.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as vec_set from './deps/sui/vec_set';
const $moduleName = 'walform::reviewers';
export const FormReviewers = new MoveStruct({ name: `${$moduleName}::FormReviewers`, fields: {
        id: bcs.Address,
        form_id: bcs.Address,
        /**
         * Cached at init so add_reviewer doesn't need `&Form` to verify the caller — owner
         * identity never changes for an existing form.
         */
        owner: bcs.Address,
        members: vec_set.VecSet(bcs.Address)
    } });
export const ReviewersCreated = new MoveStruct({ name: `${$moduleName}::ReviewersCreated`, fields: {
        form_id: bcs.Address,
        reviewers_id: bcs.Address,
        owner: bcs.Address
    } });
export const ReviewerAdded = new MoveStruct({ name: `${$moduleName}::ReviewerAdded`, fields: {
        form_id: bcs.Address,
        reviewers_id: bcs.Address,
        by: bcs.Address,
        member: bcs.Address
    } });
export const ReviewerRemoved = new MoveStruct({ name: `${$moduleName}::ReviewerRemoved`, fields: {
        form_id: bcs.Address,
        reviewers_id: bcs.Address,
        by: bcs.Address,
        member: bcs.Address
    } });
export interface CreateAndShareArguments {
    cap: RawTransactionArgument<string>;
    form: RawTransactionArgument<string>;
}
export interface CreateAndShareOptions {
    package?: string;
    arguments: CreateAndShareArguments | [
        cap: RawTransactionArgument<string>,
        form: RawTransactionArgument<string>
    ];
}
/**
 * Owner-gated. Creates and shares the tracker. Called atomically inside the
 * publish PTBs so every fresh form ships with an empty reviewer set.
 */
export function createAndShare(options: CreateAndShareOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "form"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reviewers',
        function: 'create_and_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddReviewerArguments {
    reviewers: RawTransactionArgument<string>;
    newMember: RawTransactionArgument<string>;
}
export interface AddReviewerOptions {
    package?: string;
    arguments: AddReviewerArguments | [
        reviewers: RawTransactionArgument<string>,
        newMember: RawTransactionArgument<string>
    ];
}
/**
 * Add a reviewer. Permitted when the caller is the form owner OR already a
 * reviewer (peer-invite model). Idempotent — adding an already-member is a no-op.
 */
export function addReviewer(options: AddReviewerOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["reviewers", "newMember"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reviewers',
        function: 'add_reviewer',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveReviewerArguments {
    cap: RawTransactionArgument<string>;
    reviewers: RawTransactionArgument<string>;
    member: RawTransactionArgument<string>;
}
export interface RemoveReviewerOptions {
    package?: string;
    arguments: RemoveReviewerArguments | [
        cap: RawTransactionArgument<string>,
        reviewers: RawTransactionArgument<string>,
        member: RawTransactionArgument<string>
    ];
}
/**
 * Remove a reviewer. Owner-only — proven by FormOwnerCap matching the tracker's
 * form_id. Reviewers cannot kick each other.
 */
export function removeReviewer(options: RemoveReviewerOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "reviewers", "member"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reviewers',
        function: 'remove_reviewer',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FormIdArguments {
    r: RawTransactionArgument<string>;
}
export interface FormIdOptions {
    package?: string;
    arguments: FormIdArguments | [
        r: RawTransactionArgument<string>
    ];
}
export function formId(options: FormIdOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reviewers',
        function: 'form_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OwnerArguments {
    r: RawTransactionArgument<string>;
}
export interface OwnerOptions {
    package?: string;
    arguments: OwnerArguments | [
        r: RawTransactionArgument<string>
    ];
}
export function owner(options: OwnerOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reviewers',
        function: 'owner',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MembersArguments {
    r: RawTransactionArgument<string>;
}
export interface MembersOptions {
    package?: string;
    arguments: MembersArguments | [
        r: RawTransactionArgument<string>
    ];
}
export function members(options: MembersOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reviewers',
        function: 'members',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsReviewerArguments {
    r: RawTransactionArgument<string>;
    who: RawTransactionArgument<string>;
}
export interface IsReviewerOptions {
    package?: string;
    arguments: IsReviewerArguments | [
        r: RawTransactionArgument<string>,
        who: RawTransactionArgument<string>
    ];
}
export function isReviewer(options: IsReviewerOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["r", "who"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reviewers',
        function: 'is_reviewer',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MemberCountArguments {
    r: RawTransactionArgument<string>;
}
export interface MemberCountOptions {
    package?: string;
    arguments: MemberCountArguments | [
        r: RawTransactionArgument<string>
    ];
}
export function memberCount(options: MemberCountOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reviewers',
        function: 'member_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ENotAllowedOptions {
    package?: string;
    arguments?: [
    ];
}
export function eNotAllowed(options: ENotAllowedOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reviewers',
        function: 'e_not_allowed',
    });
}
export interface EWrongFormOptions {
    package?: string;
    arguments?: [
    ];
}
export function eWrongForm(options: EWrongFormOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reviewers',
        function: 'e_wrong_form',
    });
}