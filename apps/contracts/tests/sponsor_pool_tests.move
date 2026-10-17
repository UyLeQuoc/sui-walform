#[test_only]
module walform::sponsor_pool_tests;

use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};
use wal::wal::WAL;
use walform::allowlist::{Self, Allowlist};
use walform::form::{Self, Form};
use walform::form_owner_cap::FormOwnerCap;
use walform::sponsor_pool::{Self, SponsorConfig, SponsorPool};
use walform::template::{Self, PlatformAdminCap};
use walform::test_utils as tu;
use walrus::blob::{Self, Blob};
use walrus::encoding;
use walrus::system::{Self, System};

const ADMIN: address = @0xAD;
const FUNDER: address = @0xF00D;

const FEE_BPS: u64 = 500;
// Walrus's test system prices are 5 (storage/unit/epoch) and 1 (write/unit);
// ceilings of 10 / 2 leave a 2x margin.
const STORAGE_CAP: u64 = 10;
const WRITE_CAP: u64 = 2;
const EPOCHS: u32 = 3;
const BLOB_SIZE: u64 = 1_000;
// Reserve more than the blob needs so costs (and the fee) are non-trivial;
// `max_cost` is computed from the reservation, so this still settles.
const RESERVED_BYTES: u64 = 100 * 1_048_576;
const RS2: u8 = 1;

const POOL_WAL: u64 = 10_000_000;
const POOL_SUI: u64 = 1_000_000;
const MAX_WAL_PER_UPLOAD: u64 = 1_000_000;
const MAX_TIP: u64 = 1_000;
const LOAN: u64 = 100_000;

// === Setup ===

fun setup(settings: form::FormSettings, max_uploads_per_address: u64): Scenario {
    let mut scenario = ts::begin(ADMIN);
    template::init_for_testing(ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, ADMIN);
    {
        let admin = ts::take_from_sender<PlatformAdminCap>(&scenario);
        sponsor_pool::create_config_and_share(
            &admin,
            FEE_BPS,
            STORAGE_CAP,
            WRITE_CAP,
            ts::ctx(&mut scenario),
        );
        ts::return_to_sender(&scenario, admin);
    };

    ts::next_tx(&mut scenario, tu::creator());
    {
        let clock = tu::make_test_clock(&mut scenario);
        let (form_obj, cap) = tu::new_form_with_settings(&mut scenario, &clock, settings);
        let mut al = allowlist::create(&cap, &clock, ts::ctx(&mut scenario));
        allowlist::add(&mut al, &cap, tu::submitter());
        form::share(form_obj);
        allowlist::share(al);
        transfer::public_transfer(cap, tu::creator());
        clock::destroy_for_testing(clock);
    };

    ts::next_tx(&mut scenario, tu::creator());
    {
        let config = ts::take_shared<SponsorConfig>(&scenario);
        let cap = ts::take_from_sender<FormOwnerCap>(&scenario);
        sponsor_pool::create_pool_and_share(
            &config,
            &cap,
            MAX_WAL_PER_UPLOAD,
            MAX_TIP,
            max_uploads_per_address,
            ts::ctx(&mut scenario),
        );
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(config);
    };

    ts::next_tx(&mut scenario, FUNDER);
    {
        let mut pool = ts::take_shared<SponsorPool>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        sponsor_pool::deposit_wal(&mut pool, coin::mint_for_testing<WAL>(POOL_WAL, ctx), ctx);
        sponsor_pool::deposit_sui(&mut pool, coin::mint_for_testing<SUI>(POOL_SUI, ctx), ctx);
        ts::return_shared(pool);
    };

    scenario
}

fun setup_public(): Scenario { setup(tu::public_settings(), 0) }

/// Registers a Walrus blob the way the SDK does: storage + write fees are
/// taken from `payment` by the (test) Walrus system itself.
fun register(system: &mut System, payment: &mut Coin<WAL>, root_hash: u256, ctx: &mut TxContext): Blob {
    assert!(encoding::encoded_blob_length(BLOB_SIZE, RS2, system.n_shards()) <= RESERVED_BYTES);
    let storage = system.reserve_space(RESERVED_BYTES, EPOCHS, payment, ctx);
    let blob_id = blob::derive_blob_id(root_hash, RS2, BLOB_SIZE);
    system.register_blob(storage, blob_id, root_hash, BLOB_SIZE, RS2, false, payment, ctx)
}

/// One full sponsored registration as `tu::submitter()`. Returns WAL spent.
fun sponsored_upload(scenario: &mut Scenario, root_hash: u256): u64 {
    ts::next_tx(scenario, tu::submitter());
    let mut pool = ts::take_shared<SponsorPool>(scenario);
    let config = ts::take_shared<SponsorConfig>(scenario);
    let form_obj = ts::take_shared<Form>(scenario);
    let al = ts::take_shared<Allowlist>(scenario);
    let clock = tu::make_test_clock(scenario);
    let ctx = ts::ctx(scenario);
    let (mut loan, receipt) = sponsor_pool::borrow(
        &mut pool, &config, &form_obj, &al, &clock, LOAN, ctx,
    );
    // After borrow: Walrus's test System resets the test TxContext sender
    // to 0x0 (it builds state from `tx_context::dummy()`).
    let mut system = system::new_for_testing(ctx);
    let blob = register(&mut system, &mut loan, root_hash, ctx);
    let spent = LOAN - loan.value();
    sponsor_pool::settle(&mut pool, &config, receipt, &blob, loan, ctx);

    transfer::public_transfer(blob, tu::submitter());
    system.destroy_for_testing();
    clock::destroy_for_testing(clock);
    ts::return_shared(pool);
    ts::return_shared(config);
    ts::return_shared(form_obj);
    ts::return_shared(al);
    spent
}

// === Happy path ===

#[test]
fun settle_returns_leftover_and_accrues_fee() {
    let mut scenario = setup_public();
    let spent = sponsored_upload(&mut scenario, 42);
    assert!(spent > 0);
    let fee = spent * FEE_BPS / 10_000;

    ts::next_tx(&mut scenario, tu::creator());
    {
        let pool = ts::take_shared<SponsorPool>(&scenario);
        assert!(sponsor_pool::pool_wal(&pool) == POOL_WAL - spent - fee);
        assert!(sponsor_pool::pool_platform_fees(&pool) == fee);
        assert!(sponsor_pool::pool_total_uploads(&pool) == 1);
        assert!(sponsor_pool::pool_total_wal_spent(&pool) == spent);
        assert!(sponsor_pool::pool_total_fees_paid(&pool) == fee);
        assert!(sponsor_pool::pool_uploads_of(&pool, tu::submitter()) == 1);
        ts::return_shared(pool);
    };

    // The blob stays with the respondent — they are its owner and the sender.
    ts::next_tx(&mut scenario, tu::submitter());
    {
        let blob = ts::take_from_sender<Blob>(&scenario);
        let pool = ts::take_shared<SponsorPool>(&scenario);
        assert!(sponsor_pool::pool_is_settled(&pool, object::id(&blob)));
        ts::return_shared(pool);
        ts::return_to_sender(&scenario, blob);
    };
    ts::end(scenario);
}

#[test]
fun fees_sweep_to_config_and_admin_withdraws() {
    let mut scenario = setup_public();
    let spent = sponsored_upload(&mut scenario, 42);
    let fee = spent * FEE_BPS / 10_000;

    ts::next_tx(&mut scenario, tu::third_party());
    {
        let mut pool = ts::take_shared<SponsorPool>(&scenario);
        let mut config = ts::take_shared<SponsorConfig>(&scenario);
        sponsor_pool::sweep_fees(&mut pool, &mut config);
        assert!(sponsor_pool::pool_platform_fees(&pool) == 0);
        assert!(sponsor_pool::config_fees(&config) == fee);
        ts::return_shared(pool);
        ts::return_shared(config);
    };

    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut config = ts::take_shared<SponsorConfig>(&scenario);
        let admin = ts::take_from_sender<PlatformAdminCap>(&scenario);
        let out = sponsor_pool::withdraw_fees(&mut config, &admin, ts::ctx(&mut scenario));
        assert!(out.value() == fee);
        assert!(sponsor_pool::config_fees(&config) == 0);
        transfer::public_transfer(out, ADMIN);
        ts::return_to_sender(&scenario, admin);
        ts::return_shared(config);
    };
    ts::end(scenario);
}

#[test]
fun relay_tip_is_paid_from_pool_sui() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, tu::submitter());
    {
        let mut pool = ts::take_shared<SponsorPool>(&scenario);
        let config = ts::take_shared<SponsorConfig>(&scenario);
        let form_obj = ts::take_shared<Form>(&scenario);
        let al = ts::take_shared<Allowlist>(&scenario);
        let clock = tu::make_test_clock(&mut scenario);
        let ctx = ts::ctx(&mut scenario);

        let (mut loan, mut receipt) = sponsor_pool::borrow(
            &mut pool, &config, &form_obj, &al, &clock, LOAN, ctx,
        );
        let tip = sponsor_pool::take_relay_tip(&mut pool, &mut receipt, MAX_TIP, ctx);
        assert!(tip.value() == MAX_TIP);
        assert!(sponsor_pool::pool_uploads_of(&pool, tu::submitter()) == 1);
        // After borrow: Walrus's test System resets the test TxContext sender
        // to 0x0 (it builds state from `tx_context::dummy()`).
        let mut system = system::new_for_testing(ctx);
        let blob = register(&mut system, &mut loan, 42, ctx);
        sponsor_pool::settle(&mut pool, &config, receipt, &blob, loan, ctx);
        assert!(sponsor_pool::pool_sui(&pool) == POOL_SUI - MAX_TIP);
        assert!(sponsor_pool::pool_total_tips_paid(&pool) == MAX_TIP);

        transfer::public_transfer(tip, @0x7E1A);
        transfer::public_transfer(blob, tu::submitter());
        system.destroy_for_testing();
        clock::destroy_for_testing(clock);
        ts::return_shared(pool);
        ts::return_shared(config);
        ts::return_shared(form_obj);
        ts::return_shared(al);
    };
    ts::end(scenario);
}

#[test]
fun allowlist_member_can_borrow() {
    let mut scenario = setup(tu::allowlist_settings(@0x0), 0);
    // `allowlist_settings` needs the allowlist id only for the client; the
    // on-chain gate checks `allowlist.form_id` + membership.
    sponsored_upload(&mut scenario, 42);
    ts::end(scenario);
}

#[test]
fun owner_withdraws_and_toggles() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, tu::creator());
    {
        let mut pool = ts::take_shared<SponsorPool>(&scenario);
        let cap = ts::take_from_sender<FormOwnerCap>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        let wal = sponsor_pool::withdraw_wal(&mut pool, &cap, 1_000, ctx);
        let sui = sponsor_pool::withdraw_sui(&mut pool, &cap, 500, ctx);
        assert!(sponsor_pool::pool_wal(&pool) == POOL_WAL - 1_000);
        assert!(sponsor_pool::pool_sui(&pool) == POOL_SUI - 500);
        sponsor_pool::set_limits(&mut pool, &cap, 7, 8, 9);
        sponsor_pool::set_enabled(&mut pool, &cap, false);
        assert!(sponsor_pool::pool_max_wal_per_upload(&pool) == 7);
        assert!(sponsor_pool::pool_max_tip_per_upload(&pool) == 8);
        assert!(sponsor_pool::pool_max_uploads_per_address(&pool) == 9);
        assert!(!sponsor_pool::pool_enabled(&pool));
        transfer::public_transfer(wal, tu::creator());
        transfer::public_transfer(sui, tu::creator());
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(pool);
    };
    ts::end(scenario);
}

#[test]
fun max_cost_rounds_up_to_whole_units() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, ADMIN);
    {
        let config = ts::take_shared<SponsorConfig>(&scenario);
        // 1 byte -> 1 unit; 1 MiB + 1 byte -> 2 units.
        assert!(sponsor_pool::max_cost(&config, 1, 3) == STORAGE_CAP * 3 + WRITE_CAP);
        assert!(
            sponsor_pool::max_cost(&config, 1_048_577, 3) == 2 * (STORAGE_CAP * 3 + WRITE_CAP),
        );
        ts::return_shared(config);
    };
    ts::end(scenario);
}

// === Abuse paths ===

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_OVERSPEND)]
fun diverting_the_loan_aborts() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, tu::submitter());
    let mut pool = ts::take_shared<SponsorPool>(&scenario);
    let config = ts::take_shared<SponsorConfig>(&scenario);
    let form_obj = ts::take_shared<Form>(&scenario);
    let al = ts::take_shared<Allowlist>(&scenario);
    let clock = tu::make_test_clock(&mut scenario);
    let ctx = ts::ctx(&mut scenario);
    let (mut loan, receipt) = sponsor_pool::borrow(
        &mut pool, &config, &form_obj, &al, &clock, LOAN, ctx,
    );
    // After borrow: Walrus's test System resets the test TxContext sender
    // to 0x0 (it builds state from `tx_context::dummy()`).
    let mut system = system::new_for_testing(ctx);
    let blob = register(&mut system, &mut loan, 42, ctx);
    // Pocket everything that's left instead of returning it.
    let stolen = loan.value();
    let _pocket = loan.split(stolen, ctx);
    sponsor_pool::settle(&mut pool, &config, receipt, &blob, loan, ctx);
    abort 0xDEAD
}

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_BLOB_ALREADY_SETTLED)]
fun one_blob_cannot_settle_two_loans() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, tu::submitter());
    let mut pool = ts::take_shared<SponsorPool>(&scenario);
    let config = ts::take_shared<SponsorConfig>(&scenario);
    let form_obj = ts::take_shared<Form>(&scenario);
    let al = ts::take_shared<Allowlist>(&scenario);
    let clock = tu::make_test_clock(&mut scenario);
    let ctx = ts::ctx(&mut scenario);
    let (mut loan, receipt) = sponsor_pool::borrow(
        &mut pool, &config, &form_obj, &al, &clock, LOAN, ctx,
    );
    // After borrow: Walrus's test System resets the test TxContext sender
    // to 0x0 (it builds state from `tx_context::dummy()`).
    let mut system = system::new_for_testing(ctx);
    let blob = register(&mut system, &mut loan, 42, ctx);
    sponsor_pool::settle(&mut pool, &config, receipt, &blob, loan, ctx);

    // Second loan, "justified" by the same blob.
    let (loan2, receipt2) = sponsor_pool::borrow(
        &mut pool, &config, &form_obj, &al, &clock, LOAN, ctx,
    );
    sponsor_pool::settle(&mut pool, &config, receipt2, &blob, loan2, ctx);
    abort 0xDEAD
}

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_ADDRESS_QUOTA)]
fun per_address_quota_is_enforced() {
    let mut scenario = setup(tu::public_settings(), 1);
    sponsored_upload(&mut scenario, 42);
    sponsored_upload(&mut scenario, 43);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_NOT_IN_ALLOWLIST)]
fun allowlist_outsider_cannot_borrow() {
    let mut scenario = setup(tu::allowlist_settings(@0x0), 0);
    ts::next_tx(&mut scenario, tu::third_party());
    let mut pool = ts::take_shared<SponsorPool>(&scenario);
    let config = ts::take_shared<SponsorConfig>(&scenario);
    let form_obj = ts::take_shared<Form>(&scenario);
    let al = ts::take_shared<Allowlist>(&scenario);
    let clock = tu::make_test_clock(&mut scenario);
    let (_loan, _receipt) = sponsor_pool::borrow(
        &mut pool, &config, &form_obj, &al, &clock, LOAN, ts::ctx(&mut scenario),
    );
    abort 0xDEAD
}

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_FORM_CLOSED)]
fun closed_form_cannot_borrow() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, tu::creator());
    {
        let mut form_obj = ts::take_shared<Form>(&scenario);
        let cap = ts::take_from_sender<FormOwnerCap>(&scenario);
        let clock = tu::make_test_clock(&mut scenario);
        form::close_form(&mut form_obj, &cap, &clock);
        clock::destroy_for_testing(clock);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(form_obj);
    };
    sponsored_upload(&mut scenario, 42);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_DEADLINE_PASSED)]
fun past_deadline_cannot_borrow() {
    let mut scenario = setup(tu::public_settings_with_limits(0, 1_000), 0);
    ts::next_tx(&mut scenario, tu::submitter());
    let mut pool = ts::take_shared<SponsorPool>(&scenario);
    let config = ts::take_shared<SponsorConfig>(&scenario);
    let form_obj = ts::take_shared<Form>(&scenario);
    let al = ts::take_shared<Allowlist>(&scenario);
    let mut clock = tu::make_test_clock(&mut scenario);
    clock.set_for_testing(1_000);
    let (_loan, _receipt) = sponsor_pool::borrow(
        &mut pool, &config, &form_obj, &al, &clock, LOAN, ts::ctx(&mut scenario),
    );
    abort 0xDEAD
}

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_POOL_DISABLED)]
fun disabled_pool_cannot_lend() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, tu::creator());
    {
        let mut pool = ts::take_shared<SponsorPool>(&scenario);
        let cap = ts::take_from_sender<FormOwnerCap>(&scenario);
        sponsor_pool::set_enabled(&mut pool, &cap, false);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(pool);
    };
    sponsored_upload(&mut scenario, 42);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_OVER_UPLOAD_CAP)]
fun loan_above_per_upload_cap_aborts() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, tu::submitter());
    let mut pool = ts::take_shared<SponsorPool>(&scenario);
    let config = ts::take_shared<SponsorConfig>(&scenario);
    let form_obj = ts::take_shared<Form>(&scenario);
    let al = ts::take_shared<Allowlist>(&scenario);
    let clock = tu::make_test_clock(&mut scenario);
    let (_loan, _receipt) = sponsor_pool::borrow(
        &mut pool, &config, &form_obj, &al, &clock, MAX_WAL_PER_UPLOAD + 1, ts::ctx(&mut scenario),
    );
    abort 0xDEAD
}

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_INSUFFICIENT_WAL)]
fun loan_plus_fee_reserve_must_fit_the_pool() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, tu::creator());
    {
        let mut pool = ts::take_shared<SponsorPool>(&scenario);
        let cap = ts::take_from_sender<FormOwnerCap>(&scenario);
        // Leave exactly LOAN: the fee reserve on top no longer fits.
        let out = sponsor_pool::withdraw_wal(&mut pool, &cap, POOL_WAL - LOAN, ts::ctx(&mut scenario));
        transfer::public_transfer(out, tu::creator());
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(pool);
    };
    sponsored_upload(&mut scenario, 42);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_OVER_TIP_CAP)]
fun tip_above_cap_aborts() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, tu::submitter());
    let mut pool = ts::take_shared<SponsorPool>(&scenario);
    let config = ts::take_shared<SponsorConfig>(&scenario);
    let form_obj = ts::take_shared<Form>(&scenario);
    let al = ts::take_shared<Allowlist>(&scenario);
    let clock = tu::make_test_clock(&mut scenario);
    let ctx = ts::ctx(&mut scenario);
    let (_loan, mut receipt) = sponsor_pool::borrow(
        &mut pool, &config, &form_obj, &al, &clock, LOAN, ctx,
    );
    let _tip = sponsor_pool::take_relay_tip(&mut pool, &mut receipt, MAX_TIP + 1, ctx);
    abort 0xDEAD
}

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_TIP_ALREADY_TAKEN)]
fun tip_only_once_per_loan() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, tu::submitter());
    let mut pool = ts::take_shared<SponsorPool>(&scenario);
    let config = ts::take_shared<SponsorConfig>(&scenario);
    let form_obj = ts::take_shared<Form>(&scenario);
    let al = ts::take_shared<Allowlist>(&scenario);
    let clock = tu::make_test_clock(&mut scenario);
    let ctx = ts::ctx(&mut scenario);
    let (_loan, mut receipt) = sponsor_pool::borrow(
        &mut pool, &config, &form_obj, &al, &clock, LOAN, ctx,
    );
    let _tip1 = sponsor_pool::take_relay_tip(&mut pool, &mut receipt, 1, ctx);
    let _tip2 = sponsor_pool::take_relay_tip(&mut pool, &mut receipt, 1, ctx);
    abort 0xDEAD
}

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_WRONG_FORM)]
fun another_forms_cap_cannot_withdraw() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, tu::third_party());
    let clock = tu::make_test_clock(&mut scenario);
    let (_other_form, other_cap) = tu::new_public_form(&mut scenario, &clock);
    let mut pool = ts::take_shared<SponsorPool>(&scenario);
    let _stolen = sponsor_pool::withdraw_wal(&mut pool, &other_cap, 1, ts::ctx(&mut scenario));
    abort 0xDEAD
}

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_FEE_TOO_HIGH)]
fun fee_is_capped() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<SponsorConfig>(&scenario);
    let admin = ts::take_from_sender<PlatformAdminCap>(&scenario);
    sponsor_pool::set_fee_bps(&mut config, &admin, sponsor_pool::max_fee_bps() + 1);
    abort 0xDEAD
}

#[test]
#[expected_failure(abort_code = walform::sponsor_pool::E_WRONG_CONFIG)]
fun pool_rejects_a_foreign_config() {
    let mut scenario = setup_public();
    ts::next_tx(&mut scenario, ADMIN);
    {
        let admin = ts::take_from_sender<PlatformAdminCap>(&scenario);
        // A 0-fee config the pool was not opened against.
        sponsor_pool::create_config_and_share(&admin, 0, 1_000, 1_000, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, admin);
    };
    ts::next_tx(&mut scenario, tu::submitter());
    let foreign_id = ts::most_recent_id_shared<SponsorConfig>().destroy_some();
    let foreign = ts::take_shared_by_id<SponsorConfig>(&scenario, foreign_id);
    let mut pool = ts::take_shared<SponsorPool>(&scenario);
    let form_obj = ts::take_shared<Form>(&scenario);
    let al = ts::take_shared<Allowlist>(&scenario);
    let clock = tu::make_test_clock(&mut scenario);
    let (_loan, _receipt) = sponsor_pool::borrow(
        &mut pool, &foreign, &form_obj, &al, &clock, LOAN, ts::ctx(&mut scenario),
    );
    abort 0xDEAD
}

