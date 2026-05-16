/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Form — the root object for one deployed form. Schema is stored inline (not
 * Walrus) per PRD §7.4; capped at MAX_SCHEMA_BYTES to bound object size. Settings
 * hold access_mode + publish-time limits.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index';
import { bcs, type BcsType } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
const $moduleName = 'walform::form';
export const FormSettings = new MoveStruct({ name: `${$moduleName}::FormSettings`, fields: {
        access_mode: bcs.u8(),
        /** Only set when access_mode == ACCESS_ALLOWLIST. */
        allowlist_id: bcs.option(bcs.Address),
        /**
         * For ACCESS_TOKEN: the Move type we gate on (Coin<T>). Stored as bytes to avoid
         * dragging TypeName generics through the struct.
         */
        required_token_type: bcs.vector(bcs.u8()),
        required_token_amount: bcs.u64(),
        /** For ACCESS_PAID: fee per submit in MIST. */
        submission_fee_mist: bcs.u64(),
        /** 0 = unlimited. */
        max_submissions: bcs.u64(),
        /** 0 = never. */
        closes_at_ms: bcs.u64()
    } });
export const FormStats = new MoveStruct({ name: `${$moduleName}::FormStats`, fields: {
        submission_count: bcs.u64(),
        total_revenue_mist: bcs.u64(),
        last_submission_at_ms: bcs.u64()
    } });
export const Form = new MoveStruct({ name: `${$moduleName}::Form`, fields: {
        id: bcs.Address,
        owner: bcs.Address,
        title: bcs.string(),
        /** FormSchema JSON bytes — stored INLINE (see PRD §7.4). */
        schema: bcs.vector(bcs.u8()),
        /** Only set if the creator opted into Mode B Walrus-Site deploy. */
        site_object_id: bcs.option(bcs.Address),
        /** Optional Walrus blob id for cover image (no cover → None). */
        cover_blob_id: bcs.option(bcs.vector(bcs.u8())),
        /** Small JSON blob with theme tokens (colors, font family). */
        theme: bcs.vector(bcs.u8()),
        settings: FormSettings,
        stats: FormStats,
        /** Flipped true by close_form(); submit() rejects closed forms. */
        closed: bcs.bool()
    } });
export interface CreateFormArguments {
    title: RawTransactionArgument<string>;
    schema: RawTransactionArgument<Array<number>>;
    theme: RawTransactionArgument<Array<number>>;
    settings: TransactionArgument;
}
export interface CreateFormOptions {
    package?: string;
    arguments: CreateFormArguments | [
        title: RawTransactionArgument<string>,
        schema: RawTransactionArgument<Array<number>>,
        theme: RawTransactionArgument<Array<number>>,
        settings: TransactionArgument
    ];
}
export function createForm(options: CreateFormOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        '0x1::string::String',
        'vector<u8>',
        'vector<u8>',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["title", "schema", "theme", "settings"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'create_form',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreateAndShareArguments {
    title: RawTransactionArgument<string>;
    schema: RawTransactionArgument<Array<number>>;
    theme: RawTransactionArgument<Array<number>>;
    settings: TransactionArgument;
}
export interface CreateAndShareOptions {
    package?: string;
    arguments: CreateAndShareArguments | [
        title: RawTransactionArgument<string>,
        schema: RawTransactionArgument<Array<number>>,
        theme: RawTransactionArgument<Array<number>>,
        settings: TransactionArgument
    ];
}
/**
 * Convenience: create + share the Form in one call. Most publish flows use this.
 * Called from PTB as
 * `form::create_and_share(title, schema, theme, form::new_settings(...), clock)`.
 */
export function createAndShare(options: CreateAndShareOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        '0x1::string::String',
        'vector<u8>',
        'vector<u8>',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["title", "schema", "theme", "settings"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'create_and_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ShareArguments {
    form: RawTransactionArgument<string>;
}
export interface ShareOptions {
    package?: string;
    arguments: ShareArguments | [
        form: RawTransactionArgument<string>
    ];
}
/**
 * Share a Form as a shared object. Package-public so template.move can call this
 * during clone flows; callers outside this package should go through
 * `create_and_share` or `mint_from_template` paths.
 */
export function share(options: ShareOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["form"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdateSchemaArguments {
    form: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    newSchema: RawTransactionArgument<Array<number>>;
}
export interface UpdateSchemaOptions {
    package?: string;
    arguments: UpdateSchemaArguments | [
        form: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        newSchema: RawTransactionArgument<Array<number>>
    ];
}
export function updateSchema(options: UpdateSchemaOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["form", "cap", "newSchema"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'update_schema',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdateSettingsArguments {
    form: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    newSettings: TransactionArgument;
}
export interface UpdateSettingsOptions {
    package?: string;
    arguments: UpdateSettingsArguments | [
        form: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        newSettings: TransactionArgument
    ];
}
export function updateSettings(options: UpdateSettingsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["form", "cap", "newSettings"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'update_settings',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetSiteObjectIdArguments {
    form: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    site: RawTransactionArgument<string>;
}
export interface SetSiteObjectIdOptions {
    package?: string;
    arguments: SetSiteObjectIdArguments | [
        form: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        site: RawTransactionArgument<string>
    ];
}
export function setSiteObjectId(options: SetSiteObjectIdOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["form", "cap", "site"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'set_site_object_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetSiteObjectIdObjArguments<T extends BcsType<any>> {
    form: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    site: RawTransactionArgument<T>;
}
export interface SetSiteObjectIdObjOptions<T extends BcsType<any>> {
    package?: string;
    arguments: SetSiteObjectIdObjArguments<T> | [
        form: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        site: RawTransactionArgument<T>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Same as `set_site_object_id` but takes the Site object by-reference and extracts
 * its id internally — lets a single PTB create the Site object and mirror it onto
 * the Form atomically (impossible with the address variant because PTBs can't read
 * a fresh object's address as a `pure.address` arg). Generic `T: key` avoids
 * hard-pinning to walrus_sites' Site type.
 */
export function setSiteObjectIdObj<T extends BcsType<any>>(options: SetSiteObjectIdObjOptions<T>) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        `${options.typeArguments[0]}`
    ] satisfies (string | null)[];
    const parameterNames = ["form", "cap", "site"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'set_site_object_id_obj',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetCoverBlobIdArguments {
    form: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    blobId: RawTransactionArgument<Array<number>>;
}
export interface SetCoverBlobIdOptions {
    package?: string;
    arguments: SetCoverBlobIdArguments | [
        form: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        blobId: RawTransactionArgument<Array<number>>
    ];
}
export function setCoverBlobId(options: SetCoverBlobIdOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["form", "cap", "blobId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'set_cover_blob_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CloseFormArguments {
    form: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
}
export interface CloseFormOptions {
    package?: string;
    arguments: CloseFormArguments | [
        form: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>
    ];
}
export function closeForm(options: CloseFormOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["form", "cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'close_form',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface NewSettingsArguments {
    accessMode: RawTransactionArgument<number>;
    allowlistId: RawTransactionArgument<string | null>;
    requiredTokenType: RawTransactionArgument<Array<number>>;
    requiredTokenAmount: RawTransactionArgument<number | bigint>;
    submissionFeeMist: RawTransactionArgument<number | bigint>;
    maxSubmissions: RawTransactionArgument<number | bigint>;
    closesAtMs: RawTransactionArgument<number | bigint>;
}
export interface NewSettingsOptions {
    package?: string;
    arguments: NewSettingsArguments | [
        accessMode: RawTransactionArgument<number>,
        allowlistId: RawTransactionArgument<string | null>,
        requiredTokenType: RawTransactionArgument<Array<number>>,
        requiredTokenAmount: RawTransactionArgument<number | bigint>,
        submissionFeeMist: RawTransactionArgument<number | bigint>,
        maxSubmissions: RawTransactionArgument<number | bigint>,
        closesAtMs: RawTransactionArgument<number | bigint>
    ];
}
export function newSettings(options: NewSettingsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        'u8',
        '0x1::option::Option<address>',
        'vector<u8>',
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["accessMode", "allowlistId", "requiredTokenType", "requiredTokenAmount", "submissionFeeMist", "maxSubmissions", "closesAtMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'new_settings',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IdAddressArguments {
    form: RawTransactionArgument<string>;
}
export interface IdAddressOptions {
    package?: string;
    arguments: IdAddressArguments | [
        form: RawTransactionArgument<string>
    ];
}
/**
 * Address form of the form's UID — the canonical "form id" used for event
 * payloads, Seal identity prefix, and cross-module references.
 */
export function idAddress(options: IdAddressOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["form"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'id_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OwnerArguments {
    form: RawTransactionArgument<string>;
}
export interface OwnerOptions {
    package?: string;
    arguments: OwnerArguments | [
        form: RawTransactionArgument<string>
    ];
}
export function owner(options: OwnerOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["form"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'owner',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TitleArguments {
    form: RawTransactionArgument<string>;
}
export interface TitleOptions {
    package?: string;
    arguments: TitleArguments | [
        form: RawTransactionArgument<string>
    ];
}
export function title(options: TitleOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["form"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'title',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SchemaArguments {
    form: RawTransactionArgument<string>;
}
export interface SchemaOptions {
    package?: string;
    arguments: SchemaArguments | [
        form: RawTransactionArgument<string>
    ];
}
export function schema(options: SchemaOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["form"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'schema',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ThemeArguments {
    form: RawTransactionArgument<string>;
}
export interface ThemeOptions {
    package?: string;
    arguments: ThemeArguments | [
        form: RawTransactionArgument<string>
    ];
}
export function theme(options: ThemeOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["form"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'theme',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SiteObjectIdArguments {
    form: RawTransactionArgument<string>;
}
export interface SiteObjectIdOptions {
    package?: string;
    arguments: SiteObjectIdArguments | [
        form: RawTransactionArgument<string>
    ];
}
export function siteObjectId(options: SiteObjectIdOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["form"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'site_object_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CoverBlobIdArguments {
    form: RawTransactionArgument<string>;
}
export interface CoverBlobIdOptions {
    package?: string;
    arguments: CoverBlobIdArguments | [
        form: RawTransactionArgument<string>
    ];
}
export function coverBlobId(options: CoverBlobIdOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["form"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'cover_blob_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SettingsArguments {
    form: RawTransactionArgument<string>;
}
export interface SettingsOptions {
    package?: string;
    arguments: SettingsArguments | [
        form: RawTransactionArgument<string>
    ];
}
export function settings(options: SettingsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["form"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'settings',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface StatsArguments {
    form: RawTransactionArgument<string>;
}
export interface StatsOptions {
    package?: string;
    arguments: StatsArguments | [
        form: RawTransactionArgument<string>
    ];
}
export function stats(options: StatsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["form"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'stats',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ClosedArguments {
    form: RawTransactionArgument<string>;
}
export interface ClosedOptions {
    package?: string;
    arguments: ClosedArguments | [
        form: RawTransactionArgument<string>
    ];
}
export function closed(options: ClosedOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["form"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'closed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccessModeArguments {
    s: TransactionArgument;
}
export interface AccessModeOptions {
    package?: string;
    arguments: AccessModeArguments | [
        s: TransactionArgument
    ];
}
export function accessMode(options: AccessModeOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'access_mode',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AllowlistIdArguments {
    s: TransactionArgument;
}
export interface AllowlistIdOptions {
    package?: string;
    arguments: AllowlistIdArguments | [
        s: TransactionArgument
    ];
}
export function allowlistId(options: AllowlistIdOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'allowlist_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubmissionFeeMistArguments {
    s: TransactionArgument;
}
export interface SubmissionFeeMistOptions {
    package?: string;
    arguments: SubmissionFeeMistArguments | [
        s: TransactionArgument
    ];
}
export function submissionFeeMist(options: SubmissionFeeMistOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'submission_fee_mist',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MaxSubmissionsArguments {
    s: TransactionArgument;
}
export interface MaxSubmissionsOptions {
    package?: string;
    arguments: MaxSubmissionsArguments | [
        s: TransactionArgument
    ];
}
export function maxSubmissions(options: MaxSubmissionsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'max_submissions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ClosesAtMsArguments {
    s: TransactionArgument;
}
export interface ClosesAtMsOptions {
    package?: string;
    arguments: ClosesAtMsArguments | [
        s: TransactionArgument
    ];
}
export function closesAtMs(options: ClosesAtMsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'closes_at_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RequiredTokenTypeArguments {
    s: TransactionArgument;
}
export interface RequiredTokenTypeOptions {
    package?: string;
    arguments: RequiredTokenTypeArguments | [
        s: TransactionArgument
    ];
}
export function requiredTokenType(options: RequiredTokenTypeOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'required_token_type',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RequiredTokenAmountArguments {
    s: TransactionArgument;
}
export interface RequiredTokenAmountOptions {
    package?: string;
    arguments: RequiredTokenAmountArguments | [
        s: TransactionArgument
    ];
}
export function requiredTokenAmount(options: RequiredTokenAmountOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'required_token_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubmissionCountArguments {
    s: TransactionArgument;
}
export interface SubmissionCountOptions {
    package?: string;
    arguments: SubmissionCountArguments | [
        s: TransactionArgument
    ];
}
export function submissionCount(options: SubmissionCountOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'submission_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TotalRevenueMistArguments {
    s: TransactionArgument;
}
export interface TotalRevenueMistOptions {
    package?: string;
    arguments: TotalRevenueMistArguments | [
        s: TransactionArgument
    ];
}
export function totalRevenueMist(options: TotalRevenueMistOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'total_revenue_mist',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccessPublicOptions {
    package?: string;
    arguments?: [
    ];
}
export function accessPublic(options: AccessPublicOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'access_public',
    });
}
export interface AccessAllowlistOptions {
    package?: string;
    arguments?: [
    ];
}
export function accessAllowlist(options: AccessAllowlistOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'access_allowlist',
    });
}
export interface AccessTokenOptions {
    package?: string;
    arguments?: [
    ];
}
export function accessToken(options: AccessTokenOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'access_token',
    });
}
export interface AccessPaidOptions {
    package?: string;
    arguments?: [
    ];
}
export function accessPaid(options: AccessPaidOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'access_paid',
    });
}
export interface MaxSchemaBytesOptions {
    package?: string;
    arguments?: [
    ];
}
export function maxSchemaBytes(options: MaxSchemaBytesOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form',
        function: 'max_schema_bytes',
    });
}