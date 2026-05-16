/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Template marketplace — FormTemplate + Kiosk integration + global
 * TransferPolicy<FormTemplate> with a 10% royalty rule installed at package init.
 * See PRD §7.2 / §8.2.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as balance from './deps/sui/balance';
const $moduleName = 'walform::template';
export const TEMPLATE = new MoveStruct({ name: `${$moduleName}::TEMPLATE`, fields: {
        dummy_field: bcs.bool()
    } });
export const RoyaltyRule = new MoveStruct({ name: `${$moduleName}::RoyaltyRule`, fields: {
        dummy_field: bcs.bool()
    } });
export const RoyaltyConfig = new MoveStruct({ name: `${$moduleName}::RoyaltyConfig`, fields: {
        bps: bcs.u16(),
        min_amount_mist: bcs.u64()
    } });
export const FormTemplate = new MoveStruct({ name: `${$moduleName}::FormTemplate`, fields: {
        id: bcs.Address,
        creator: bcs.Address,
        title: bcs.string(),
        description: bcs.string(),
        category: bcs.u8(),
        /**
         * Inline schema JSON — same 100 KB cap as Form.schema. Copied into a fresh Form
         * when cloned.
         */
        schema: bcs.vector(bcs.u8()),
        theme: bcs.vector(bcs.u8()),
        preview_blob_id: bcs.option(bcs.vector(bcs.u8())),
        tags: bcs.vector(bcs.string()),
        created_at_ms: bcs.u64(),
        clone_count: bcs.u64()
    } });
export const PlatformTreasury = new MoveStruct({ name: `${$moduleName}::PlatformTreasury`, fields: {
        id: bcs.Address,
        balance: balance.Balance
    } });
export const PlatformAdminCap = new MoveStruct({ name: `${$moduleName}::PlatformAdminCap`, fields: {
        id: bcs.Address
    } });
export const TemplateListing = new MoveStruct({ name: `${$moduleName}::TemplateListing`, fields: {
        id: bcs.Address,
        template_id: bcs.Address,
        creator: bcs.Address,
        price_mist: bcs.u64()
    } });
export interface PublishTemplateArguments {
    cap: RawTransactionArgument<string>;
    form: RawTransactionArgument<string>;
    title: RawTransactionArgument<string>;
    description: RawTransactionArgument<string>;
    category: RawTransactionArgument<number>;
    previewBlobId: RawTransactionArgument<Array<number> | null>;
    tags: RawTransactionArgument<Array<string>>;
}
export interface PublishTemplateOptions {
    package?: string;
    arguments: PublishTemplateArguments | [
        cap: RawTransactionArgument<string>,
        form: RawTransactionArgument<string>,
        title: RawTransactionArgument<string>,
        description: RawTransactionArgument<string>,
        category: RawTransactionArgument<number>,
        previewBlobId: RawTransactionArgument<Array<number> | null>,
        tags: RawTransactionArgument<Array<string>>
    ];
}
export function publishTemplate(options: PublishTemplateOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        '0x1::string::String',
        'u8',
        '0x1::option::Option<vector<u8>>',
        'vector<0x1::string::String>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "form", "title", "description", "category", "previewBlobId", "tags"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'publish_template',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PlaceAndListArguments {
    kiosk: RawTransactionArgument<string>;
    kioskCap: RawTransactionArgument<string>;
    template: RawTransactionArgument<string>;
    priceMist: RawTransactionArgument<number | bigint>;
}
export interface PlaceAndListOptions {
    package?: string;
    arguments: PlaceAndListArguments | [
        kiosk: RawTransactionArgument<string>,
        kioskCap: RawTransactionArgument<string>,
        template: RawTransactionArgument<string>,
        priceMist: RawTransactionArgument<number | bigint>
    ];
}
/**
 * DEPRECATED — kept only for Sui upgrade compatibility. The active paid
 * marketplace path is `create_listing_and_share` + `clone_paid_and_share`
 * (TemplateListing). Do not call from new code; the TS client no longer has a
 * publish-via-Kiosk path. See PRD Appendix A 2026-05-12.
 */
export function placeAndList(options: PlaceAndListOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["kiosk", "kioskCap", "template", "priceMist"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'place_and_list',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreateListingArguments {
    template: RawTransactionArgument<string>;
    priceMist: RawTransactionArgument<number | bigint>;
}
export interface CreateListingOptions {
    package?: string;
    arguments: CreateListingArguments | [
        template: RawTransactionArgument<string>,
        priceMist: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Creator lists a shared FormTemplate at `price_mist`. Anyone can then call
 * `clone_paid` on it. The listing is a separate shared object so price can be
 * updated without re-minting the template.
 */
export function createListing(options: CreateListingOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["template", "priceMist"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'create_listing',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreateListingAndShareArguments {
    template: RawTransactionArgument<string>;
    priceMist: RawTransactionArgument<number | bigint>;
}
export interface CreateListingAndShareOptions {
    package?: string;
    arguments: CreateListingAndShareArguments | [
        template: RawTransactionArgument<string>,
        priceMist: RawTransactionArgument<number | bigint>
    ];
}
/** Convenience: create + share the listing in one tx. */
export function createListingAndShare(options: CreateListingAndShareOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["template", "priceMist"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'create_listing_and_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ClonePaidArguments {
    template: RawTransactionArgument<string>;
    listing: RawTransactionArgument<string>;
    treasury: RawTransactionArgument<string>;
    policy: RawTransactionArgument<string>;
    payment: RawTransactionArgument<string>;
    royaltyPayment: RawTransactionArgument<string>;
    ownerSettings: TransactionArgument;
    titleForNew: RawTransactionArgument<string>;
}
export interface ClonePaidOptions {
    package?: string;
    arguments: ClonePaidArguments | [
        template: RawTransactionArgument<string>,
        listing: RawTransactionArgument<string>,
        treasury: RawTransactionArgument<string>,
        policy: RawTransactionArgument<string>,
        payment: RawTransactionArgument<string>,
        royaltyPayment: RawTransactionArgument<string>,
        ownerSettings: TransactionArgument,
        titleForNew: RawTransactionArgument<string>
    ];
}
/**
 * Buyer calls this to clone a paid template: pays price to creator, pays 10% (or
 * floor) royalty to the platform treasury, gets a fresh Form. The template object
 * is NOT consumed — next buyer can do the same.
 */
export function clonePaid(options: ClonePaidOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        '0x1::string::String',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["template", "listing", "treasury", "policy", "payment", "royaltyPayment", "ownerSettings", "titleForNew"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'clone_paid',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ClonePaidAndShareArguments {
    template: RawTransactionArgument<string>;
    listing: RawTransactionArgument<string>;
    treasury: RawTransactionArgument<string>;
    policy: RawTransactionArgument<string>;
    payment: RawTransactionArgument<string>;
    royaltyPayment: RawTransactionArgument<string>;
    ownerSettings: TransactionArgument;
    titleForNew: RawTransactionArgument<string>;
}
export interface ClonePaidAndShareOptions {
    package?: string;
    arguments: ClonePaidAndShareArguments | [
        template: RawTransactionArgument<string>,
        listing: RawTransactionArgument<string>,
        treasury: RawTransactionArgument<string>,
        policy: RawTransactionArgument<string>,
        payment: RawTransactionArgument<string>,
        royaltyPayment: RawTransactionArgument<string>,
        ownerSettings: TransactionArgument,
        titleForNew: RawTransactionArgument<string>
    ];
}
export function clonePaidAndShare(options: ClonePaidAndShareOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        '0x1::string::String',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["template", "listing", "treasury", "policy", "payment", "royaltyPayment", "ownerSettings", "titleForNew"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'clone_paid_and_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PurchaseTemplateOnlyArguments {
    template: RawTransactionArgument<string>;
    listing: RawTransactionArgument<string>;
    treasury: RawTransactionArgument<string>;
    policy: RawTransactionArgument<string>;
    payment: RawTransactionArgument<string>;
    royaltyPayment: RawTransactionArgument<string>;
}
export interface PurchaseTemplateOnlyOptions {
    package?: string;
    arguments: PurchaseTemplateOnlyArguments | [
        template: RawTransactionArgument<string>,
        listing: RawTransactionArgument<string>,
        treasury: RawTransactionArgument<string>,
        policy: RawTransactionArgument<string>,
        payment: RawTransactionArgument<string>,
        royaltyPayment: RawTransactionArgument<string>
    ];
}
export function purchaseTemplateOnly(options: PurchaseTemplateOnlyOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["template", "listing", "treasury", "policy", "payment", "royaltyPayment"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'purchase_template_only',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RecordFreeCloneArguments {
    template: RawTransactionArgument<string>;
}
export interface RecordFreeCloneOptions {
    package?: string;
    arguments: RecordFreeCloneArguments | [
        template: RawTransactionArgument<string>
    ];
}
/**
 * Zero-payment counterpart for free templates. Lets the client bump `clone_count`
 * after the user actually publishes a form drafted from this template, so the
 * marketplace metric stays universal across free + paid.
 */
export function recordFreeClone(options: RecordFreeCloneOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["template"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'record_free_clone',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdateListingPriceArguments {
    listing: RawTransactionArgument<string>;
    newPriceMist: RawTransactionArgument<number | bigint>;
}
export interface UpdateListingPriceOptions {
    package?: string;
    arguments: UpdateListingPriceArguments | [
        listing: RawTransactionArgument<string>,
        newPriceMist: RawTransactionArgument<number | bigint>
    ];
}
export function updateListingPrice(options: UpdateListingPriceOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["listing", "newPriceMist"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'update_listing_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ListingTemplateIdArguments {
    l: RawTransactionArgument<string>;
}
export interface ListingTemplateIdOptions {
    package?: string;
    arguments: ListingTemplateIdArguments | [
        l: RawTransactionArgument<string>
    ];
}
export function listingTemplateId(options: ListingTemplateIdOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["l"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'listing_template_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ListingCreatorArguments {
    l: RawTransactionArgument<string>;
}
export interface ListingCreatorOptions {
    package?: string;
    arguments: ListingCreatorArguments | [
        l: RawTransactionArgument<string>
    ];
}
export function listingCreator(options: ListingCreatorOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["l"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'listing_creator',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ListingPriceMistArguments {
    l: RawTransactionArgument<string>;
}
export interface ListingPriceMistOptions {
    package?: string;
    arguments: ListingPriceMistArguments | [
        l: RawTransactionArgument<string>
    ];
}
export function listingPriceMist(options: ListingPriceMistOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["l"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'listing_price_mist',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CloneFreeArguments {
    template: RawTransactionArgument<string>;
    ownerSettings: TransactionArgument;
    titleForNew: RawTransactionArgument<string>;
}
export interface CloneFreeOptions {
    package?: string;
    arguments: CloneFreeArguments | [
        template: RawTransactionArgument<string>,
        ownerSettings: TransactionArgument,
        titleForNew: RawTransactionArgument<string>
    ];
}
export function cloneFree(options: CloneFreeOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["template", "ownerSettings", "titleForNew"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'clone_free',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CloneFreeAndShareArguments {
    template: RawTransactionArgument<string>;
    ownerSettings: TransactionArgument;
    titleForNew: RawTransactionArgument<string>;
}
export interface CloneFreeAndShareOptions {
    package?: string;
    arguments: CloneFreeAndShareArguments | [
        template: RawTransactionArgument<string>,
        ownerSettings: TransactionArgument,
        titleForNew: RawTransactionArgument<string>
    ];
}
export function cloneFreeAndShare(options: CloneFreeAndShareOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["template", "ownerSettings", "titleForNew"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'clone_free_and_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PurchaseTemplateArguments {
    sellerKiosk: RawTransactionArgument<string>;
    templateId: RawTransactionArgument<string>;
    policy: RawTransactionArgument<string>;
    treasury: RawTransactionArgument<string>;
    payment: RawTransactionArgument<string>;
    royaltyPayment: RawTransactionArgument<string>;
    ownerSettings: TransactionArgument;
    titleForNew: RawTransactionArgument<string>;
}
export interface PurchaseTemplateOptions {
    package?: string;
    arguments: PurchaseTemplateArguments | [
        sellerKiosk: RawTransactionArgument<string>,
        templateId: RawTransactionArgument<string>,
        policy: RawTransactionArgument<string>,
        treasury: RawTransactionArgument<string>,
        payment: RawTransactionArgument<string>,
        royaltyPayment: RawTransactionArgument<string>,
        ownerSettings: TransactionArgument,
        titleForNew: RawTransactionArgument<string>
    ];
}
/** DEPRECATED — see section header. Use `clone_paid_and_share` instead. */
export function purchaseTemplate(options: PurchaseTemplateOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        'address',
        null,
        null,
        null,
        null,
        null,
        '0x1::string::String',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["sellerKiosk", "templateId", "policy", "treasury", "payment", "royaltyPayment", "ownerSettings", "titleForNew"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'purchase_template',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PurchaseTemplateAndShareArguments {
    sellerKiosk: RawTransactionArgument<string>;
    templateId: RawTransactionArgument<string>;
    policy: RawTransactionArgument<string>;
    treasury: RawTransactionArgument<string>;
    payment: RawTransactionArgument<string>;
    royaltyPayment: RawTransactionArgument<string>;
    ownerSettings: TransactionArgument;
    titleForNew: RawTransactionArgument<string>;
}
export interface PurchaseTemplateAndShareOptions {
    package?: string;
    arguments: PurchaseTemplateAndShareArguments | [
        sellerKiosk: RawTransactionArgument<string>,
        templateId: RawTransactionArgument<string>,
        policy: RawTransactionArgument<string>,
        treasury: RawTransactionArgument<string>,
        payment: RawTransactionArgument<string>,
        royaltyPayment: RawTransactionArgument<string>,
        ownerSettings: TransactionArgument,
        titleForNew: RawTransactionArgument<string>
    ];
}
/** DEPRECATED — see section header. Use `clone_paid_and_share` instead. */
export function purchaseTemplateAndShare(options: PurchaseTemplateAndShareOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        'address',
        null,
        null,
        null,
        null,
        null,
        '0x1::string::String',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["sellerKiosk", "templateId", "policy", "treasury", "payment", "royaltyPayment", "ownerSettings", "titleForNew"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'purchase_template_and_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface WithdrawPlatformArguments {
    Cap: RawTransactionArgument<string>;
    treasury: RawTransactionArgument<string>;
    amountMist: RawTransactionArgument<number | bigint>;
}
export interface WithdrawPlatformOptions {
    package?: string;
    arguments: WithdrawPlatformArguments | [
        Cap: RawTransactionArgument<string>,
        treasury: RawTransactionArgument<string>,
        amountMist: RawTransactionArgument<number | bigint>
    ];
}
export function withdrawPlatform(options: WithdrawPlatformOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "treasury", "amountMist"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'withdraw_platform',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IdAddressArguments {
    t: RawTransactionArgument<string>;
}
export interface IdAddressOptions {
    package?: string;
    arguments: IdAddressArguments | [
        t: RawTransactionArgument<string>
    ];
}
export function idAddress(options: IdAddressOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["t"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'id_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreatorArguments {
    t: RawTransactionArgument<string>;
}
export interface CreatorOptions {
    package?: string;
    arguments: CreatorArguments | [
        t: RawTransactionArgument<string>
    ];
}
export function creator(options: CreatorOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["t"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'creator',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TitleArguments {
    t: RawTransactionArgument<string>;
}
export interface TitleOptions {
    package?: string;
    arguments: TitleArguments | [
        t: RawTransactionArgument<string>
    ];
}
export function title(options: TitleOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["t"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'title',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DescriptionArguments {
    t: RawTransactionArgument<string>;
}
export interface DescriptionOptions {
    package?: string;
    arguments: DescriptionArguments | [
        t: RawTransactionArgument<string>
    ];
}
export function description(options: DescriptionOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["t"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'description',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CategoryArguments {
    t: RawTransactionArgument<string>;
}
export interface CategoryOptions {
    package?: string;
    arguments: CategoryArguments | [
        t: RawTransactionArgument<string>
    ];
}
export function category(options: CategoryOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["t"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'category',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SchemaArguments {
    t: RawTransactionArgument<string>;
}
export interface SchemaOptions {
    package?: string;
    arguments: SchemaArguments | [
        t: RawTransactionArgument<string>
    ];
}
export function schema(options: SchemaOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["t"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'schema',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ThemeArguments {
    t: RawTransactionArgument<string>;
}
export interface ThemeOptions {
    package?: string;
    arguments: ThemeArguments | [
        t: RawTransactionArgument<string>
    ];
}
export function theme(options: ThemeOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["t"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'theme',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TagsArguments {
    t: RawTransactionArgument<string>;
}
export interface TagsOptions {
    package?: string;
    arguments: TagsArguments | [
        t: RawTransactionArgument<string>
    ];
}
export function tags(options: TagsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["t"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'tags',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CloneCountArguments {
    t: RawTransactionArgument<string>;
}
export interface CloneCountOptions {
    package?: string;
    arguments: CloneCountArguments | [
        t: RawTransactionArgument<string>
    ];
}
export function cloneCount(options: CloneCountOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["t"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'clone_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PlatformBalanceArguments {
    t: RawTransactionArgument<string>;
}
export interface PlatformBalanceOptions {
    package?: string;
    arguments: PlatformBalanceArguments | [
        t: RawTransactionArgument<string>
    ];
}
export function platformBalance(options: PlatformBalanceOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["t"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'platform_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PlatformRoyaltyBpsOptions {
    package?: string;
    arguments?: [
    ];
}
export function platformRoyaltyBps(options: PlatformRoyaltyBpsOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'platform_royalty_bps',
    });
}
export interface PlatformMinRoyaltyMistOptions {
    package?: string;
    arguments?: [
    ];
}
export function platformMinRoyaltyMist(options: PlatformMinRoyaltyMistOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'template',
        function: 'platform_min_royalty_mist',
    });
}