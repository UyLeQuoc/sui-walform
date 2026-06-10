/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Template upvote/downvote — one vote per voter per template, stored as a dynamic
 * field on a shared `TemplateVotes` object keyed by voter address. Toggle
 * semantics: calling `upvote` twice clears the up-vote; calling `downvote` after
 * `upvote` switches sides.
 * 
 * `TemplateVotes` is created lazily by the template creator. The publish PTBs fold
 * `init_template_votes` in atomically so every fresh template ships with a
 * tracker. Pre-feature templates can be initialized by their creator post-hoc —
 * voting is the same call either way.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
const $moduleName = 'walform::voting';
export const TemplateVotes = new MoveStruct({ name: `${$moduleName}::TemplateVotes`, fields: {
        id: bcs.Address,
        template_id: bcs.Address,
        upvotes: bcs.u64(),
        downvotes: bcs.u64()
    } });
export const VoteRecord = new MoveStruct({ name: `${$moduleName}::VoteRecord`, fields: {
        value: bcs.u8()
    } });
export const TemplateVotesInitialized = new MoveStruct({ name: `${$moduleName}::TemplateVotesInitialized`, fields: {
        template_id: bcs.Address,
        votes_id: bcs.Address
    } });
export const VoteCast = new MoveStruct({ name: `${$moduleName}::VoteCast`, fields: {
        template_id: bcs.Address,
        voter: bcs.Address,
        /** 0 = cleared (toggled-off), 1 = up, 2 = down */
        value: bcs.u8(),
        upvotes: bcs.u64(),
        downvotes: bcs.u64()
    } });
export interface InitTemplateVotesArguments {
    template: RawTransactionArgument<string>;
}
export interface InitTemplateVotesOptions {
    package?: string;
    arguments: InitTemplateVotesArguments | [
        template: RawTransactionArgument<string>
    ];
}
/**
 * Creator-only. Creates a shared `TemplateVotes` for the given template. Emits
 * `TemplateVotesInitialized` so clients can discover the tracker.
 *
 * Permissionless via re-call is technically possible (creator could create
 * duplicates), but clients dedupe by picking the earliest event per template_id.
 * Wasted gas, no functional issue.
 */
export function initTemplateVotes(options: InitTemplateVotesOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["template"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'voting',
        function: 'init_template_votes',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpvoteArguments {
    votes: RawTransactionArgument<string>;
}
export interface UpvoteOptions {
    package?: string;
    arguments: UpvoteArguments | [
        votes: RawTransactionArgument<string>
    ];
}
/** Cast (or toggle off) an up-vote. */
export function upvote(options: UpvoteOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["votes"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'voting',
        function: 'upvote',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DownvoteArguments {
    votes: RawTransactionArgument<string>;
}
export interface DownvoteOptions {
    package?: string;
    arguments: DownvoteArguments | [
        votes: RawTransactionArgument<string>
    ];
}
/** Cast (or toggle off) a down-vote. */
export function downvote(options: DownvoteOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["votes"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'voting',
        function: 'downvote',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ClearVoteArguments {
    votes: RawTransactionArgument<string>;
}
export interface ClearVoteOptions {
    package?: string;
    arguments: ClearVoteArguments | [
        votes: RawTransactionArgument<string>
    ];
}
/** Clear the caller's vote (whichever side). */
export function clearVote(options: ClearVoteOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["votes"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'voting',
        function: 'clear_vote',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TemplateIdArguments {
    v: RawTransactionArgument<string>;
}
export interface TemplateIdOptions {
    package?: string;
    arguments: TemplateIdArguments | [
        v: RawTransactionArgument<string>
    ];
}
export function templateId(options: TemplateIdOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'voting',
        function: 'template_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpvotesArguments {
    v: RawTransactionArgument<string>;
}
export interface UpvotesOptions {
    package?: string;
    arguments: UpvotesArguments | [
        v: RawTransactionArgument<string>
    ];
}
export function upvotes(options: UpvotesOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'voting',
        function: 'upvotes',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DownvotesArguments {
    v: RawTransactionArgument<string>;
}
export interface DownvotesOptions {
    package?: string;
    arguments: DownvotesArguments | [
        v: RawTransactionArgument<string>
    ];
}
export function downvotes(options: DownvotesOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'voting',
        function: 'downvotes',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VoteOfArguments {
    v: RawTransactionArgument<string>;
    voter: RawTransactionArgument<string>;
}
export interface VoteOfOptions {
    package?: string;
    arguments: VoteOfArguments | [
        v: RawTransactionArgument<string>,
        voter: RawTransactionArgument<string>
    ];
}
/** Returns the caller's current vote on this template: 0 / 1 / 2. */
export function voteOf(options: VoteOfOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["v", "voter"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'voting',
        function: 'vote_of',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VoteNoneOptions {
    package?: string;
    arguments?: [
    ];
}
export function voteNone(options: VoteNoneOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'voting',
        function: 'vote_none',
    });
}
export interface VoteUpOptions {
    package?: string;
    arguments?: [
    ];
}
export function voteUp(options: VoteUpOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'voting',
        function: 'vote_up',
    });
}
export interface VoteDownOptions {
    package?: string;
    arguments?: [
    ];
}
export function voteDown(options: VoteDownOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'voting',
        function: 'vote_down',
    });
}