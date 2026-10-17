/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Creator-funded Walrus storage sponsorship for form respondents.
 * 
 * A form owner opens a `SponsorPool` and funds it with WAL (storage) and SUI
 * (upload-relay tips). A respondent with no WAL/SUI can then register their
 * submission blobs on Walrus as the transaction SENDER — the pool only lends the
 * WAL — while a gas sponsor covers SUI gas.
 * 
 * One sponsored blob = one PTB, signed by the respondent:
 * 
 * (coin, receipt) = sponsor_pool::borrow(pool, config, form, allowlist, clock,
 * amount) tip = sponsor_pool::take_relay_tip(pool, &mut receipt, tip_amount) //
 * optional blob = walrus::system::register_blob(..., reserve_space(..., coin),
 * ..., coin) sponsor_pool::settle(pool, config, receipt, &blob, coin)
 * 
 * Walrus is called from the PTB, never from this module: `walrus::system` mutators
 * assert `system.version == VERSION`, so a module that called them would abort
 * after every Walrus upgrade until re-linked. `settle` only reads `Blob` /
 * `Storage` getters, which carry no version gate.
 * 
 * `SponsorReceipt` has no abilities, so the loan cannot leave the PTB unsettled.
 * `settle` bounds what a PTB can divert from the loan: the WAL spent may not
 * exceed the cost of the registered blob's storage at the platform's price
 * ceilings, each blob settles once, and it must be fresh (uncertified).
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as balance from './deps/sui/balance.js';
import * as table from './deps/sui/table.js';
const $moduleName = 'walform::sponsor_pool';
export const SponsorConfig = new MoveStruct({ name: `${$moduleName}::SponsorConfig`, fields: {
        id: bcs.Address,
        fee_bps: bcs.u64(),
        /**
         * Ceilings, not live prices: FROST per 1 MiB storage unit (per epoch for storage).
         * Keep them a margin above Walrus's current prices — `settle` aborts if a
         * registration costs more than these allow.
         */
        max_storage_price_per_unit: bcs.u64(),
        max_write_price_per_unit: bcs.u64(),
        fees: balance.Balance
    } });
export const SponsorPool = new MoveStruct({ name: `${$moduleName}::SponsorPool`, fields: {
        id: bcs.Address,
        form_id: bcs.Address,
        config_id: bcs.Address,
        wal: balance.Balance,
        sui: balance.Balance,
        /**
         * Platform fees accrued by this pool, swept into `SponsorConfig.fees`. Kept per
         * pool so `settle` never writes the global config.
         */
        platform_fees: balance.Balance,
        enabled: bcs.bool(),
        max_wal_per_upload: bcs.u64(),
        max_tip_per_upload: bcs.u64(),
        /** 0 = unlimited. */
        max_uploads_per_address: bcs.u64(),
        uploads_by_address: table.Table,
        settled_blobs: table.Table,
        total_uploads: bcs.u64(),
        total_wal_spent: bcs.u64(),
        total_fees_paid: bcs.u64(),
        total_tips_paid: bcs.u64()
    } });
export const SponsorReceipt = new MoveStruct({ name: `${$moduleName}::SponsorReceipt`, fields: {
        pool_id: bcs.Address,
        borrowed: bcs.u64(),
        fee_bps: bcs.u64(),
        fee_reserve: balance.Balance,
        tip: bcs.u64(),
        tip_taken: bcs.bool()
    } });
export const SponsorConfigCreated = new MoveStruct({ name: `${$moduleName}::SponsorConfigCreated`, fields: {
        config_id: bcs.Address,
        fee_bps: bcs.u64(),
        max_storage_price_per_unit: bcs.u64(),
        max_write_price_per_unit: bcs.u64()
    } });
export const SponsorConfigUpdated = new MoveStruct({ name: `${$moduleName}::SponsorConfigUpdated`, fields: {
        config_id: bcs.Address,
        fee_bps: bcs.u64(),
        max_storage_price_per_unit: bcs.u64(),
        max_write_price_per_unit: bcs.u64()
    } });
export const SponsorFeesWithdrawn = new MoveStruct({ name: `${$moduleName}::SponsorFeesWithdrawn`, fields: {
        config_id: bcs.Address,
        amount: bcs.u64()
    } });
export const SponsorPoolCreated = new MoveStruct({ name: `${$moduleName}::SponsorPoolCreated`, fields: {
        pool_id: bcs.Address,
        form_id: bcs.Address,
        config_id: bcs.Address,
        creator: bcs.Address
    } });
export const SponsorPoolFunded = new MoveStruct({ name: `${$moduleName}::SponsorPoolFunded`, fields: {
        pool_id: bcs.Address,
        form_id: bcs.Address,
        funder: bcs.Address,
        wal: bcs.u64(),
        sui: bcs.u64()
    } });
export const SponsorPoolWithdrawn = new MoveStruct({ name: `${$moduleName}::SponsorPoolWithdrawn`, fields: {
        pool_id: bcs.Address,
        form_id: bcs.Address,
        wal: bcs.u64(),
        sui: bcs.u64()
    } });
export const SponsorPoolUpdated = new MoveStruct({ name: `${$moduleName}::SponsorPoolUpdated`, fields: {
        pool_id: bcs.Address,
        form_id: bcs.Address,
        enabled: bcs.bool(),
        max_wal_per_upload: bcs.u64(),
        max_tip_per_upload: bcs.u64(),
        max_uploads_per_address: bcs.u64()
    } });
export const SponsoredBlobRegistered = new MoveStruct({ name: `${$moduleName}::SponsoredBlobRegistered`, fields: {
        pool_id: bcs.Address,
        form_id: bcs.Address,
        uploader: bcs.Address,
        blob_object_id: bcs.Address,
        blob_id: bcs.u256(),
        encoded_size: bcs.u64(),
        end_epoch: bcs.u32(),
        wal_spent: bcs.u64(),
        fee: bcs.u64(),
        tip: bcs.u64()
    } });
export interface CreateConfigArguments {
    Admin: RawTransactionArgument<string>;
    feeBps: RawTransactionArgument<number | bigint>;
    maxStoragePricePerUnit: RawTransactionArgument<number | bigint>;
    maxWritePricePerUnit: RawTransactionArgument<number | bigint>;
}
export interface CreateConfigOptions {
    package?: string;
    arguments: CreateConfigArguments | [
        Admin: RawTransactionArgument<string>,
        feeBps: RawTransactionArgument<number | bigint>,
        maxStoragePricePerUnit: RawTransactionArgument<number | bigint>,
        maxWritePricePerUnit: RawTransactionArgument<number | bigint>
    ];
}
export function createConfig(options: CreateConfigOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["Admin", "feeBps", "maxStoragePricePerUnit", "maxWritePricePerUnit"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'create_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ShareConfigArguments {
    config: RawTransactionArgument<string>;
}
export interface ShareConfigOptions {
    package?: string;
    arguments: ShareConfigArguments | [
        config: RawTransactionArgument<string>
    ];
}
export function shareConfig(options: ShareConfigOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["config"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'share_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreateConfigAndShareArguments {
    admin: RawTransactionArgument<string>;
    feeBps: RawTransactionArgument<number | bigint>;
    maxStoragePricePerUnit: RawTransactionArgument<number | bigint>;
    maxWritePricePerUnit: RawTransactionArgument<number | bigint>;
}
export interface CreateConfigAndShareOptions {
    package?: string;
    arguments: CreateConfigAndShareArguments | [
        admin: RawTransactionArgument<string>,
        feeBps: RawTransactionArgument<number | bigint>,
        maxStoragePricePerUnit: RawTransactionArgument<number | bigint>,
        maxWritePricePerUnit: RawTransactionArgument<number | bigint>
    ];
}
export function createConfigAndShare(options: CreateConfigAndShareOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["admin", "feeBps", "maxStoragePricePerUnit", "maxWritePricePerUnit"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'create_config_and_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetFeeBpsArguments {
    config: RawTransactionArgument<string>;
    Admin: RawTransactionArgument<string>;
    feeBps: RawTransactionArgument<number | bigint>;
}
export interface SetFeeBpsOptions {
    package?: string;
    arguments: SetFeeBpsArguments | [
        config: RawTransactionArgument<string>,
        Admin: RawTransactionArgument<string>,
        feeBps: RawTransactionArgument<number | bigint>
    ];
}
export function setFeeBps(options: SetFeeBpsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Admin", "feeBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'set_fee_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetPriceCapsArguments {
    config: RawTransactionArgument<string>;
    Admin: RawTransactionArgument<string>;
    maxStoragePricePerUnit: RawTransactionArgument<number | bigint>;
    maxWritePricePerUnit: RawTransactionArgument<number | bigint>;
}
export interface SetPriceCapsOptions {
    package?: string;
    arguments: SetPriceCapsArguments | [
        config: RawTransactionArgument<string>,
        Admin: RawTransactionArgument<string>,
        maxStoragePricePerUnit: RawTransactionArgument<number | bigint>,
        maxWritePricePerUnit: RawTransactionArgument<number | bigint>
    ];
}
export function setPriceCaps(options: SetPriceCapsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Admin", "maxStoragePricePerUnit", "maxWritePricePerUnit"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'set_price_caps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface WithdrawFeesArguments {
    config: RawTransactionArgument<string>;
    Admin: RawTransactionArgument<string>;
}
export interface WithdrawFeesOptions {
    package?: string;
    arguments: WithdrawFeesArguments | [
        config: RawTransactionArgument<string>,
        Admin: RawTransactionArgument<string>
    ];
}
export function withdrawFees(options: WithdrawFeesOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Admin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'withdraw_fees',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SweepFeesArguments {
    pool: RawTransactionArgument<string>;
    config: RawTransactionArgument<string>;
}
export interface SweepFeesOptions {
    package?: string;
    arguments: SweepFeesArguments | [
        pool: RawTransactionArgument<string>,
        config: RawTransactionArgument<string>
    ];
}
/**
 * Moves a pool's accrued platform fees into the config. Permissionless: the fees
 * can only ever land in the config the pool was opened against.
 */
export function sweepFees(options: SweepFeesOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "config"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'sweep_fees',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreatePoolArguments {
    config: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    maxWalPerUpload: RawTransactionArgument<number | bigint>;
    maxTipPerUpload: RawTransactionArgument<number | bigint>;
    maxUploadsPerAddress: RawTransactionArgument<number | bigint>;
}
export interface CreatePoolOptions {
    package?: string;
    arguments: CreatePoolArguments | [
        config: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        maxWalPerUpload: RawTransactionArgument<number | bigint>,
        maxTipPerUpload: RawTransactionArgument<number | bigint>,
        maxUploadsPerAddress: RawTransactionArgument<number | bigint>
    ];
}
export function createPool(options: CreatePoolOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "cap", "maxWalPerUpload", "maxTipPerUpload", "maxUploadsPerAddress"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'create_pool',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SharePoolArguments {
    pool: RawTransactionArgument<string>;
}
export interface SharePoolOptions {
    package?: string;
    arguments: SharePoolArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function sharePool(options: SharePoolOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'share_pool',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreatePoolAndShareArguments {
    config: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    maxWalPerUpload: RawTransactionArgument<number | bigint>;
    maxTipPerUpload: RawTransactionArgument<number | bigint>;
    maxUploadsPerAddress: RawTransactionArgument<number | bigint>;
}
export interface CreatePoolAndShareOptions {
    package?: string;
    arguments: CreatePoolAndShareArguments | [
        config: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        maxWalPerUpload: RawTransactionArgument<number | bigint>,
        maxTipPerUpload: RawTransactionArgument<number | bigint>,
        maxUploadsPerAddress: RawTransactionArgument<number | bigint>
    ];
}
export function createPoolAndShare(options: CreatePoolAndShareOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "cap", "maxWalPerUpload", "maxTipPerUpload", "maxUploadsPerAddress"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'create_pool_and_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetLimitsArguments {
    pool: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    maxWalPerUpload: RawTransactionArgument<number | bigint>;
    maxTipPerUpload: RawTransactionArgument<number | bigint>;
    maxUploadsPerAddress: RawTransactionArgument<number | bigint>;
}
export interface SetLimitsOptions {
    package?: string;
    arguments: SetLimitsArguments | [
        pool: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        maxWalPerUpload: RawTransactionArgument<number | bigint>,
        maxTipPerUpload: RawTransactionArgument<number | bigint>,
        maxUploadsPerAddress: RawTransactionArgument<number | bigint>
    ];
}
export function setLimits(options: SetLimitsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "cap", "maxWalPerUpload", "maxTipPerUpload", "maxUploadsPerAddress"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'set_limits',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetEnabledArguments {
    pool: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    enabled: RawTransactionArgument<boolean>;
}
export interface SetEnabledOptions {
    package?: string;
    arguments: SetEnabledArguments | [
        pool: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        enabled: RawTransactionArgument<boolean>
    ];
}
export function setEnabled(options: SetEnabledOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'bool'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "cap", "enabled"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'set_enabled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface WithdrawWalArguments {
    pool: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface WithdrawWalOptions {
    package?: string;
    arguments: WithdrawWalArguments | [
        pool: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>
    ];
}
export function withdrawWal(options: WithdrawWalOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "cap", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'withdraw_wal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface WithdrawSuiArguments {
    pool: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface WithdrawSuiOptions {
    package?: string;
    arguments: WithdrawSuiArguments | [
        pool: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>
    ];
}
export function withdrawSui(options: WithdrawSuiOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "cap", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'withdraw_sui',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DepositWalArguments {
    pool: RawTransactionArgument<string>;
    payment: RawTransactionArgument<string>;
}
export interface DepositWalOptions {
    package?: string;
    arguments: DepositWalArguments | [
        pool: RawTransactionArgument<string>,
        payment: RawTransactionArgument<string>
    ];
}
export function depositWal(options: DepositWalOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "payment"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'deposit_wal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DepositSuiArguments {
    pool: RawTransactionArgument<string>;
    payment: RawTransactionArgument<string>;
}
export interface DepositSuiOptions {
    package?: string;
    arguments: DepositSuiArguments | [
        pool: RawTransactionArgument<string>,
        payment: RawTransactionArgument<string>
    ];
}
export function depositSui(options: DepositSuiOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "payment"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'deposit_sui',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BorrowArguments {
    pool: RawTransactionArgument<string>;
    config: RawTransactionArgument<string>;
    form: RawTransactionArgument<string>;
    allowlist: RawTransactionArgument<string>;
    walAmount: RawTransactionArgument<number | bigint>;
}
export interface BorrowOptions {
    package?: string;
    arguments: BorrowArguments | [
        pool: RawTransactionArgument<string>,
        config: RawTransactionArgument<string>,
        form: RawTransactionArgument<string>,
        allowlist: RawTransactionArgument<string>,
        walAmount: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Lends `wal_amount` WAL for one blob registration. The sender must be able to
 * submit to `form` right now (same gate as `submission::submit`), so a pool can't
 * be spent on a closed, full, or allowlist-excluded form.
 */
export function borrow(options: BorrowOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        '0x2::clock::Clock',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "config", "form", "allowlist", "walAmount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'borrow',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TakeRelayTipArguments {
    pool: RawTransactionArgument<string>;
    receipt: TransactionArgument;
    amount: RawTransactionArgument<number | bigint>;
}
export interface TakeRelayTipOptions {
    package?: string;
    arguments: TakeRelayTipArguments | [
        pool: RawTransactionArgument<string>,
        receipt: TransactionArgument,
        amount: RawTransactionArgument<number | bigint>
    ];
}
/**
 * SUI for the Walrus upload relay's tip, which the relay requires inside the
 * registration transaction. At most once per receipt, capped per upload.
 */
export function takeRelayTip(options: TakeRelayTipOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "receipt", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'take_relay_tip',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SettleArguments {
    pool: RawTransactionArgument<string>;
    config: RawTransactionArgument<string>;
    receipt: TransactionArgument;
    blob: RawTransactionArgument<string>;
    leftover: RawTransactionArgument<string>;
}
export interface SettleOptions {
    package?: string;
    arguments: SettleArguments | [
        pool: RawTransactionArgument<string>,
        config: RawTransactionArgument<string>,
        receipt: TransactionArgument,
        blob: RawTransactionArgument<string>,
        leftover: RawTransactionArgument<string>
    ];
}
/**
 * Closes a loan against the blob it paid for. `leftover` is the loan coin after
 * Walrus took the storage + write payments.
 */
export function settle(options: SettleOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "config", "receipt", "blob", "leftover"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'settle',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MaxCostArguments {
    config: RawTransactionArgument<string>;
    encodedSize: RawTransactionArgument<number | bigint>;
    epochs: RawTransactionArgument<number>;
}
export interface MaxCostOptions {
    package?: string;
    arguments: MaxCostArguments | [
        config: RawTransactionArgument<string>,
        encodedSize: RawTransactionArgument<number | bigint>,
        epochs: RawTransactionArgument<number>
    ];
}
/**
 * Highest WAL a registration of `encoded_size` bytes for `epochs` epochs may cost
 * under `config`'s price ceilings. Clients use it to pre-check that a sponsored
 * upload will settle.
 */
export function maxCost(options: MaxCostOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        'u64',
        'u32'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "encodedSize", "epochs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'max_cost',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ConfigFeeBpsArguments {
    config: RawTransactionArgument<string>;
}
export interface ConfigFeeBpsOptions {
    package?: string;
    arguments: ConfigFeeBpsArguments | [
        config: RawTransactionArgument<string>
    ];
}
export function configFeeBps(options: ConfigFeeBpsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["config"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'config_fee_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ConfigMaxStoragePricePerUnitArguments {
    config: RawTransactionArgument<string>;
}
export interface ConfigMaxStoragePricePerUnitOptions {
    package?: string;
    arguments: ConfigMaxStoragePricePerUnitArguments | [
        config: RawTransactionArgument<string>
    ];
}
export function configMaxStoragePricePerUnit(options: ConfigMaxStoragePricePerUnitOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["config"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'config_max_storage_price_per_unit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ConfigMaxWritePricePerUnitArguments {
    config: RawTransactionArgument<string>;
}
export interface ConfigMaxWritePricePerUnitOptions {
    package?: string;
    arguments: ConfigMaxWritePricePerUnitArguments | [
        config: RawTransactionArgument<string>
    ];
}
export function configMaxWritePricePerUnit(options: ConfigMaxWritePricePerUnitOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["config"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'config_max_write_price_per_unit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ConfigFeesArguments {
    config: RawTransactionArgument<string>;
}
export interface ConfigFeesOptions {
    package?: string;
    arguments: ConfigFeesArguments | [
        config: RawTransactionArgument<string>
    ];
}
export function configFees(options: ConfigFeesOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["config"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'config_fees',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MaxFeeBpsOptions {
    package?: string;
    arguments?: [
    ];
}
export function maxFeeBps(options: MaxFeeBpsOptions = {}) {
    const packageAddress = options.package ?? 'walform';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'max_fee_bps',
    });
}
export interface PoolFormIdArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolFormIdOptions {
    package?: string;
    arguments: PoolFormIdArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function poolFormId(options: PoolFormIdOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_form_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolConfigIdArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolConfigIdOptions {
    package?: string;
    arguments: PoolConfigIdArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function poolConfigId(options: PoolConfigIdOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_config_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolWalArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolWalOptions {
    package?: string;
    arguments: PoolWalArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function poolWal(options: PoolWalOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_wal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolSuiArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolSuiOptions {
    package?: string;
    arguments: PoolSuiArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function poolSui(options: PoolSuiOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_sui',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolPlatformFeesArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolPlatformFeesOptions {
    package?: string;
    arguments: PoolPlatformFeesArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function poolPlatformFees(options: PoolPlatformFeesOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_platform_fees',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolEnabledArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolEnabledOptions {
    package?: string;
    arguments: PoolEnabledArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function poolEnabled(options: PoolEnabledOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_enabled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolMaxWalPerUploadArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolMaxWalPerUploadOptions {
    package?: string;
    arguments: PoolMaxWalPerUploadArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function poolMaxWalPerUpload(options: PoolMaxWalPerUploadOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_max_wal_per_upload',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolMaxTipPerUploadArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolMaxTipPerUploadOptions {
    package?: string;
    arguments: PoolMaxTipPerUploadArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function poolMaxTipPerUpload(options: PoolMaxTipPerUploadOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_max_tip_per_upload',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolMaxUploadsPerAddressArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolMaxUploadsPerAddressOptions {
    package?: string;
    arguments: PoolMaxUploadsPerAddressArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function poolMaxUploadsPerAddress(options: PoolMaxUploadsPerAddressOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_max_uploads_per_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolUploadsOfArguments {
    pool: RawTransactionArgument<string>;
    uploader: RawTransactionArgument<string>;
}
export interface PoolUploadsOfOptions {
    package?: string;
    arguments: PoolUploadsOfArguments | [
        pool: RawTransactionArgument<string>,
        uploader: RawTransactionArgument<string>
    ];
}
export function poolUploadsOf(options: PoolUploadsOfOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "uploader"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_uploads_of',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolIsSettledArguments {
    pool: RawTransactionArgument<string>;
    blobObjectId: RawTransactionArgument<string>;
}
export interface PoolIsSettledOptions {
    package?: string;
    arguments: PoolIsSettledArguments | [
        pool: RawTransactionArgument<string>,
        blobObjectId: RawTransactionArgument<string>
    ];
}
export function poolIsSettled(options: PoolIsSettledOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "blobObjectId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_is_settled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolTotalUploadsArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolTotalUploadsOptions {
    package?: string;
    arguments: PoolTotalUploadsArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function poolTotalUploads(options: PoolTotalUploadsOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_total_uploads',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolTotalWalSpentArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolTotalWalSpentOptions {
    package?: string;
    arguments: PoolTotalWalSpentArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function poolTotalWalSpent(options: PoolTotalWalSpentOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_total_wal_spent',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolTotalFeesPaidArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolTotalFeesPaidOptions {
    package?: string;
    arguments: PoolTotalFeesPaidArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function poolTotalFeesPaid(options: PoolTotalFeesPaidOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_total_fees_paid',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolTotalTipsPaidArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolTotalTipsPaidOptions {
    package?: string;
    arguments: PoolTotalTipsPaidArguments | [
        pool: RawTransactionArgument<string>
    ];
}
export function poolTotalTipsPaid(options: PoolTotalTipsPaidOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sponsor_pool',
        function: 'pool_total_tips_paid',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}