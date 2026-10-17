/// Creator-funded Walrus storage sponsorship for form respondents.
///
/// A form owner opens a `SponsorPool` and funds it with WAL (storage) and SUI
/// (upload-relay tips). A respondent with no WAL/SUI can then register their
/// submission blobs on Walrus as the transaction SENDER — the pool only lends
/// the WAL — while a gas sponsor covers SUI gas.
///
/// One sponsored blob = one PTB, signed by the respondent:
///
///   (coin, receipt) = sponsor_pool::borrow(pool, config, form, allowlist, clock, amount)
///   tip             = sponsor_pool::take_relay_tip(pool, &mut receipt, tip_amount)   // optional
///   blob            = walrus::system::register_blob(..., reserve_space(..., coin), ..., coin)
///   sponsor_pool::settle(pool, config, receipt, &blob, coin)
///
/// Walrus is called from the PTB, never from this module: `walrus::system`
/// mutators assert `system.version == VERSION`, so a module that called them
/// would abort after every Walrus upgrade until re-linked. `settle` only reads
/// `Blob` / `Storage` getters, which carry no version gate.
///
/// `SponsorReceipt` has no abilities, so the loan cannot leave the PTB
/// unsettled. `settle` bounds what a PTB can divert from the loan: the WAL
/// spent may not exceed the cost of the registered blob's storage at the
/// platform's price ceilings, each blob settles once, and it must be fresh
/// (uncertified).
module walform::sponsor_pool;

use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use sui::table::{Self, Table};
use wal::wal::WAL;
use walform::allowlist::{Self, Allowlist};
use walform::form::{Self, Form};
use walform::form_owner_cap::{Self, FormOwnerCap};
use walform::template::PlatformAdminCap;
use walrus::blob::{Self, Blob};
use walrus::storage_resource;

// === Constants ===

const BPS_DENOMINATOR: u64 = 10_000;
/// Upper bound on the platform fee, so a compromised admin key cannot confiscate pools.
const MAX_FEE_BPS: u64 = 2_000;
/// Walrus storage unit (`BYTES_PER_UNIT_SIZE` in walrus::system_state_inner).
const BYTES_PER_UNIT: u64 = 1_048_576;

// === Errors ===

const E_WRONG_FORM: u64 = 1;
const E_POOL_DISABLED: u64 = 2;
const E_OVER_UPLOAD_CAP: u64 = 3;
const E_OVER_TIP_CAP: u64 = 4;
const E_ADDRESS_QUOTA: u64 = 5;
const E_INSUFFICIENT_WAL: u64 = 6;
const E_INSUFFICIENT_SUI: u64 = 7;
const E_WRONG_POOL: u64 = 8;
const E_WRONG_CONFIG: u64 = 9;
const E_BLOB_ALREADY_SETTLED: u64 = 10;
const E_BLOB_ALREADY_CERTIFIED: u64 = 11;
const E_OVERSPEND: u64 = 12;
const E_LEFTOVER_EXCEEDS_LOAN: u64 = 13;
const E_FEE_TOO_HIGH: u64 = 14;
const E_TIP_ALREADY_TAKEN: u64 = 15;
const E_FORM_CLOSED: u64 = 16;
const E_DEADLINE_PASSED: u64 = 17;
const E_SUBMISSION_CAP_REACHED: u64 = 18;
const E_NOT_IN_ALLOWLIST: u64 = 19;
const E_WRONG_ALLOWLIST: u64 = 20;
const E_ZERO_LOAN: u64 = 21;

// === Structs ===

/// Platform-wide settings, one shared object per network. Created by the
/// holder of `PlatformAdminCap` (upgrades don't run `init`).
public struct SponsorConfig has key {
    id: UID,
    fee_bps: u64,
    /// Ceilings, not live prices: FROST per 1 MiB storage unit (per epoch for
    /// storage). Keep them a margin above Walrus's current prices — `settle`
    /// aborts if a registration costs more than these allow.
    max_storage_price_per_unit: u64,
    max_write_price_per_unit: u64,
    fees: Balance<WAL>,
}

public struct SponsorPool has key {
    id: UID,
    form_id: address,
    config_id: ID,
    wal: Balance<WAL>,
    sui: Balance<SUI>,
    /// Platform fees accrued by this pool, swept into `SponsorConfig.fees`.
    /// Kept per pool so `settle` never writes the global config.
    platform_fees: Balance<WAL>,
    enabled: bool,
    max_wal_per_upload: u64,
    max_tip_per_upload: u64,
    /// 0 = unlimited.
    max_uploads_per_address: u64,
    uploads_by_address: Table<address, u64>,
    settled_blobs: Table<ID, bool>,
    total_uploads: u64,
    total_wal_spent: u64,
    total_fees_paid: u64,
    total_tips_paid: u64,
}

/// Hot potato: must be consumed by `settle` in the same PTB.
public struct SponsorReceipt {
    pool_id: ID,
    borrowed: u64,
    fee_bps: u64,
    fee_reserve: Balance<WAL>,
    tip: u64,
    tip_taken: bool,
}

// === Events ===

public struct SponsorConfigCreated has copy, drop {
    config_id: ID,
    fee_bps: u64,
    max_storage_price_per_unit: u64,
    max_write_price_per_unit: u64,
}

public struct SponsorConfigUpdated has copy, drop {
    config_id: ID,
    fee_bps: u64,
    max_storage_price_per_unit: u64,
    max_write_price_per_unit: u64,
}

public struct SponsorFeesWithdrawn has copy, drop {
    config_id: ID,
    amount: u64,
}

public struct SponsorPoolCreated has copy, drop {
    pool_id: ID,
    form_id: address,
    config_id: ID,
    creator: address,
}

public struct SponsorPoolFunded has copy, drop {
    pool_id: ID,
    form_id: address,
    funder: address,
    wal: u64,
    sui: u64,
}

public struct SponsorPoolWithdrawn has copy, drop {
    pool_id: ID,
    form_id: address,
    wal: u64,
    sui: u64,
}

public struct SponsorPoolUpdated has copy, drop {
    pool_id: ID,
    form_id: address,
    enabled: bool,
    max_wal_per_upload: u64,
    max_tip_per_upload: u64,
    max_uploads_per_address: u64,
}

public struct SponsoredBlobRegistered has copy, drop {
    pool_id: ID,
    form_id: address,
    uploader: address,
    blob_object_id: ID,
    blob_id: u256,
    encoded_size: u64,
    end_epoch: u32,
    wal_spent: u64,
    fee: u64,
    tip: u64,
}

// === Platform config (admin) ===

public fun create_config(
    _admin: &PlatformAdminCap,
    fee_bps: u64,
    max_storage_price_per_unit: u64,
    max_write_price_per_unit: u64,
    ctx: &mut TxContext,
): SponsorConfig {
    assert!(fee_bps <= MAX_FEE_BPS, E_FEE_TOO_HIGH);
    let config = SponsorConfig {
        id: object::new(ctx),
        fee_bps,
        max_storage_price_per_unit,
        max_write_price_per_unit,
        fees: balance::zero(),
    };
    event::emit(SponsorConfigCreated {
        config_id: object::id(&config),
        fee_bps,
        max_storage_price_per_unit,
        max_write_price_per_unit,
    });
    config
}

public fun share_config(config: SponsorConfig) { transfer::share_object(config) }

public fun create_config_and_share(
    admin: &PlatformAdminCap,
    fee_bps: u64,
    max_storage_price_per_unit: u64,
    max_write_price_per_unit: u64,
    ctx: &mut TxContext,
) {
    share_config(
        create_config(admin, fee_bps, max_storage_price_per_unit, max_write_price_per_unit, ctx),
    );
}

public fun set_fee_bps(config: &mut SponsorConfig, _admin: &PlatformAdminCap, fee_bps: u64) {
    assert!(fee_bps <= MAX_FEE_BPS, E_FEE_TOO_HIGH);
    config.fee_bps = fee_bps;
    emit_config_updated(config);
}

public fun set_price_caps(
    config: &mut SponsorConfig,
    _admin: &PlatformAdminCap,
    max_storage_price_per_unit: u64,
    max_write_price_per_unit: u64,
) {
    config.max_storage_price_per_unit = max_storage_price_per_unit;
    config.max_write_price_per_unit = max_write_price_per_unit;
    emit_config_updated(config);
}

public fun withdraw_fees(
    config: &mut SponsorConfig,
    _admin: &PlatformAdminCap,
    ctx: &mut TxContext,
): Coin<WAL> {
    let amount = config.fees.value();
    event::emit(SponsorFeesWithdrawn { config_id: object::id(config), amount });
    coin::from_balance(config.fees.withdraw_all(), ctx)
}

/// Moves a pool's accrued platform fees into the config. Permissionless: the
/// fees can only ever land in the config the pool was opened against.
public fun sweep_fees(pool: &mut SponsorPool, config: &mut SponsorConfig) {
    assert!(pool.config_id == object::id(config), E_WRONG_CONFIG);
    config.fees.join(pool.platform_fees.withdraw_all());
}

// === Pool lifecycle (form owner) ===

public fun create_pool(
    config: &SponsorConfig,
    cap: &FormOwnerCap,
    max_wal_per_upload: u64,
    max_tip_per_upload: u64,
    max_uploads_per_address: u64,
    ctx: &mut TxContext,
): SponsorPool {
    let pool = SponsorPool {
        id: object::new(ctx),
        form_id: form_owner_cap::form_id(cap),
        config_id: object::id(config),
        wal: balance::zero(),
        sui: balance::zero(),
        platform_fees: balance::zero(),
        enabled: true,
        max_wal_per_upload,
        max_tip_per_upload,
        max_uploads_per_address,
        uploads_by_address: table::new(ctx),
        settled_blobs: table::new(ctx),
        total_uploads: 0,
        total_wal_spent: 0,
        total_fees_paid: 0,
        total_tips_paid: 0,
    };
    event::emit(SponsorPoolCreated {
        pool_id: object::id(&pool),
        form_id: pool.form_id,
        config_id: pool.config_id,
        creator: ctx.sender(),
    });
    pool
}

public fun share_pool(pool: SponsorPool) { transfer::share_object(pool) }

public fun create_pool_and_share(
    config: &SponsorConfig,
    cap: &FormOwnerCap,
    max_wal_per_upload: u64,
    max_tip_per_upload: u64,
    max_uploads_per_address: u64,
    ctx: &mut TxContext,
) {
    share_pool(
        create_pool(
            config,
            cap,
            max_wal_per_upload,
            max_tip_per_upload,
            max_uploads_per_address,
            ctx,
        ),
    );
}

public fun set_limits(
    pool: &mut SponsorPool,
    cap: &FormOwnerCap,
    max_wal_per_upload: u64,
    max_tip_per_upload: u64,
    max_uploads_per_address: u64,
) {
    assert_owner(pool, cap);
    pool.max_wal_per_upload = max_wal_per_upload;
    pool.max_tip_per_upload = max_tip_per_upload;
    pool.max_uploads_per_address = max_uploads_per_address;
    emit_pool_updated(pool);
}

public fun set_enabled(pool: &mut SponsorPool, cap: &FormOwnerCap, enabled: bool) {
    assert_owner(pool, cap);
    pool.enabled = enabled;
    emit_pool_updated(pool);
}

public fun withdraw_wal(
    pool: &mut SponsorPool,
    cap: &FormOwnerCap,
    amount: u64,
    ctx: &mut TxContext,
): Coin<WAL> {
    assert_owner(pool, cap);
    assert!(pool.wal.value() >= amount, E_INSUFFICIENT_WAL);
    event::emit(SponsorPoolWithdrawn {
        pool_id: object::id(pool),
        form_id: pool.form_id,
        wal: amount,
        sui: 0,
    });
    coin::from_balance(pool.wal.split(amount), ctx)
}

public fun withdraw_sui(
    pool: &mut SponsorPool,
    cap: &FormOwnerCap,
    amount: u64,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert_owner(pool, cap);
    assert!(pool.sui.value() >= amount, E_INSUFFICIENT_SUI);
    event::emit(SponsorPoolWithdrawn {
        pool_id: object::id(pool),
        form_id: pool.form_id,
        wal: 0,
        sui: amount,
    });
    coin::from_balance(pool.sui.split(amount), ctx)
}

// === Funding (anyone) ===

public fun deposit_wal(pool: &mut SponsorPool, payment: Coin<WAL>, ctx: &TxContext) {
    let amount = payment.value();
    pool.wal.join(payment.into_balance());
    event::emit(SponsorPoolFunded {
        pool_id: object::id(pool),
        form_id: pool.form_id,
        funder: ctx.sender(),
        wal: amount,
        sui: 0,
    });
}

public fun deposit_sui(pool: &mut SponsorPool, payment: Coin<SUI>, ctx: &TxContext) {
    let amount = payment.value();
    pool.sui.join(payment.into_balance());
    event::emit(SponsorPoolFunded {
        pool_id: object::id(pool),
        form_id: pool.form_id,
        funder: ctx.sender(),
        wal: 0,
        sui: amount,
    });
}

// === Sponsored upload (respondent) ===

/// Lends `wal_amount` WAL for one blob registration. The sender must be able
/// to submit to `form` right now (same gate as `submission::submit`), so a
/// pool can't be spent on a closed, full, or allowlist-excluded form.
public fun borrow(
    pool: &mut SponsorPool,
    config: &SponsorConfig,
    form: &Form,
    allowlist: &Allowlist,
    clock: &Clock,
    wal_amount: u64,
    ctx: &mut TxContext,
): (Coin<WAL>, SponsorReceipt) {
    assert!(pool.config_id == object::id(config), E_WRONG_CONFIG);
    assert!(form::id_address(form) == pool.form_id, E_WRONG_FORM);
    assert!(pool.enabled, E_POOL_DISABLED);
    assert!(wal_amount > 0, E_ZERO_LOAN);
    assert!(wal_amount <= pool.max_wal_per_upload, E_OVER_UPLOAD_CAP);
    assert_can_submit(form, allowlist, clock, ctx.sender());

    let sender = ctx.sender();
    let used = if (pool.uploads_by_address.contains(sender)) {
        *pool.uploads_by_address.borrow(sender)
    } else {
        0
    };
    assert!(
        pool.max_uploads_per_address == 0 || used < pool.max_uploads_per_address,
        E_ADDRESS_QUOTA,
    );
    if (pool.uploads_by_address.contains(sender)) {
        *pool.uploads_by_address.borrow_mut(sender) = used + 1;
    } else {
        pool.uploads_by_address.add(sender, 1);
    };

    let fee_bps = config.fee_bps;
    let max_fee = mul_div(wal_amount, fee_bps, BPS_DENOMINATOR);
    assert!(pool.wal.value() >= wal_amount + max_fee, E_INSUFFICIENT_WAL);

    let loan = coin::from_balance(pool.wal.split(wal_amount), ctx);
    let receipt = SponsorReceipt {
        pool_id: object::id(pool),
        borrowed: wal_amount,
        fee_bps,
        fee_reserve: pool.wal.split(max_fee),
        tip: 0,
        tip_taken: false,
    };
    (loan, receipt)
}

/// SUI for the Walrus upload relay's tip, which the relay requires inside the
/// registration transaction. At most once per receipt, capped per upload.
public fun take_relay_tip(
    pool: &mut SponsorPool,
    receipt: &mut SponsorReceipt,
    amount: u64,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(receipt.pool_id == object::id(pool), E_WRONG_POOL);
    assert!(!receipt.tip_taken, E_TIP_ALREADY_TAKEN);
    assert!(amount <= pool.max_tip_per_upload, E_OVER_TIP_CAP);
    assert!(pool.sui.value() >= amount, E_INSUFFICIENT_SUI);
    receipt.tip_taken = true;
    receipt.tip = amount;
    coin::from_balance(pool.sui.split(amount), ctx)
}

/// Closes a loan against the blob it paid for. `leftover` is the loan coin
/// after Walrus took the storage + write payments.
public fun settle(
    pool: &mut SponsorPool,
    config: &SponsorConfig,
    receipt: SponsorReceipt,
    blob: &Blob,
    leftover: Coin<WAL>,
    ctx: &TxContext,
) {
    let storage = blob::storage(blob);
    settle_inner(
        pool,
        config,
        receipt,
        object::id(blob),
        blob::blob_id(blob),
        blob::certified_epoch(blob).is_some(),
        storage_resource::size(storage),
        storage_resource::start_epoch(storage),
        storage_resource::end_epoch(storage),
        leftover,
        ctx.sender(),
    );
}

// === Views ===

/// Highest WAL a registration of `encoded_size` bytes for `epochs` epochs may
/// cost under `config`'s price ceilings. Clients use it to pre-check that a
/// sponsored upload will settle.
public fun max_cost(config: &SponsorConfig, encoded_size: u64, epochs: u32): u64 {
    let units = (encoded_size + BYTES_PER_UNIT - 1) / BYTES_PER_UNIT;
    let per_unit =
        (config.max_storage_price_per_unit as u128) * (epochs as u128)
            + (config.max_write_price_per_unit as u128);
    ((units as u128) * per_unit) as u64
}

public fun config_fee_bps(config: &SponsorConfig): u64 { config.fee_bps }
public fun config_max_storage_price_per_unit(config: &SponsorConfig): u64 {
    config.max_storage_price_per_unit
}
public fun config_max_write_price_per_unit(config: &SponsorConfig): u64 {
    config.max_write_price_per_unit
}
public fun config_fees(config: &SponsorConfig): u64 { config.fees.value() }
public fun max_fee_bps(): u64 { MAX_FEE_BPS }

public fun pool_form_id(pool: &SponsorPool): address { pool.form_id }
public fun pool_config_id(pool: &SponsorPool): ID { pool.config_id }
public fun pool_wal(pool: &SponsorPool): u64 { pool.wal.value() }
public fun pool_sui(pool: &SponsorPool): u64 { pool.sui.value() }
public fun pool_platform_fees(pool: &SponsorPool): u64 { pool.platform_fees.value() }
public fun pool_enabled(pool: &SponsorPool): bool { pool.enabled }
public fun pool_max_wal_per_upload(pool: &SponsorPool): u64 { pool.max_wal_per_upload }
public fun pool_max_tip_per_upload(pool: &SponsorPool): u64 { pool.max_tip_per_upload }
public fun pool_max_uploads_per_address(pool: &SponsorPool): u64 {
    pool.max_uploads_per_address
}
public fun pool_uploads_of(pool: &SponsorPool, uploader: address): u64 {
    if (pool.uploads_by_address.contains(uploader)) {
        *pool.uploads_by_address.borrow(uploader)
    } else {
        0
    }
}
public fun pool_is_settled(pool: &SponsorPool, blob_object_id: ID): bool {
    pool.settled_blobs.contains(blob_object_id)
}
public fun pool_total_uploads(pool: &SponsorPool): u64 { pool.total_uploads }
public fun pool_total_wal_spent(pool: &SponsorPool): u64 { pool.total_wal_spent }
public fun pool_total_fees_paid(pool: &SponsorPool): u64 { pool.total_fees_paid }
public fun pool_total_tips_paid(pool: &SponsorPool): u64 { pool.total_tips_paid }

// === Internals ===

fun settle_inner(
    pool: &mut SponsorPool,
    config: &SponsorConfig,
    receipt: SponsorReceipt,
    blob_object_id: ID,
    blob_id: u256,
    certified: bool,
    encoded_size: u64,
    start_epoch: u32,
    end_epoch: u32,
    leftover: Coin<WAL>,
    uploader: address,
) {
    let SponsorReceipt { pool_id, borrowed, fee_bps, mut fee_reserve, tip, tip_taken: _ } = receipt;
    assert!(pool_id == object::id(pool), E_WRONG_POOL);
    assert!(pool.config_id == object::id(config), E_WRONG_CONFIG);
    assert!(!certified, E_BLOB_ALREADY_CERTIFIED);
    assert!(!pool.settled_blobs.contains(blob_object_id), E_BLOB_ALREADY_SETTLED);

    let returned = leftover.value();
    assert!(returned <= borrowed, E_LEFTOVER_EXCEEDS_LOAN);
    let spent = borrowed - returned;
    assert!(spent <= max_cost(config, encoded_size, end_epoch - start_epoch), E_OVERSPEND);

    pool.wal.join(leftover.into_balance());
    let fee = mul_div(spent, fee_bps, BPS_DENOMINATOR);
    pool.platform_fees.join(fee_reserve.split(fee));
    pool.wal.join(fee_reserve);

    pool.settled_blobs.add(blob_object_id, true);
    pool.total_uploads = pool.total_uploads + 1;
    pool.total_wal_spent = pool.total_wal_spent + spent;
    pool.total_fees_paid = pool.total_fees_paid + fee;
    pool.total_tips_paid = pool.total_tips_paid + tip;

    event::emit(SponsoredBlobRegistered {
        pool_id,
        form_id: pool.form_id,
        uploader,
        blob_object_id,
        blob_id,
        encoded_size,
        end_epoch,
        wal_spent: spent,
        fee,
        tip,
    });
}

fun assert_can_submit(form: &Form, allowlist: &Allowlist, clock: &Clock, sender: address) {
    assert!(!form::closed(form), E_FORM_CLOSED);
    let settings = form::settings(form);
    let closes_at = form::closes_at_ms(settings);
    assert!(closes_at == 0 || clock.timestamp_ms() < closes_at, E_DEADLINE_PASSED);
    let cap = form::max_submissions(settings);
    assert!(
        cap == 0 || form::submission_count(form::stats(form)) < cap,
        E_SUBMISSION_CAP_REACHED,
    );
    if (form::access_mode(settings) == form::access_allowlist()) {
        assert!(allowlist::form_id(allowlist) == form::id_address(form), E_WRONG_ALLOWLIST);
        assert!(allowlist::contains(allowlist, sender), E_NOT_IN_ALLOWLIST);
    };
}

fun assert_owner(pool: &SponsorPool, cap: &FormOwnerCap) {
    assert!(form_owner_cap::form_id(cap) == pool.form_id, E_WRONG_FORM);
}

fun mul_div(a: u64, b: u64, denominator: u64): u64 {
    ((a as u128) * (b as u128) / (denominator as u128)) as u64
}

fun emit_config_updated(config: &SponsorConfig) {
    event::emit(SponsorConfigUpdated {
        config_id: object::id(config),
        fee_bps: config.fee_bps,
        max_storage_price_per_unit: config.max_storage_price_per_unit,
        max_write_price_per_unit: config.max_write_price_per_unit,
    });
}

fun emit_pool_updated(pool: &SponsorPool) {
    event::emit(SponsorPoolUpdated {
        pool_id: object::id(pool),
        form_id: pool.form_id,
        enabled: pool.enabled,
        max_wal_per_upload: pool.max_wal_per_upload,
        max_tip_per_upload: pool.max_tip_per_upload,
        max_uploads_per_address: pool.max_uploads_per_address,
    });
}
