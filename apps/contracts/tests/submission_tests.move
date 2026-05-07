#[test_only]
module walform::submission_tests;

use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;
use walform::allowlist::{Self, Allowlist};
use walform::form::{Self, Form};
use walform::payment::{Self, FormTreasury};
use walform::submission;
use walform::test_utils as tu;

// Note: we don't test MAX_ENCRYPTED_BODY_BYTES overflow in unit tests —
// constructing a 200KB vector byte-by-byte in the Move VM exhausts test-mode
// gas. The size check is a one-line `assert!` and is covered by TS integration
// tests against a deployed package.

#[test]
fun test_public_submit_succeeds() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);

    // In creator's tx: create + share form and (dummy) allowlist.
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);
    let al = allowlist::create(&cap, &clock_obj, ts::ctx(&mut scenario));
    form::share(form_obj);
    walform::allowlist::share(al);
    sui::transfer::public_transfer(cap, tu::creator());

    // Switch to submitter and submit.
    ts::next_tx(&mut scenario, tu::submitter());
    let mut form_obj = ts::take_shared<Form>(&scenario);
    let al = ts::take_shared<Allowlist>(&scenario);

    let s = submission::submit(
        &mut form_obj,
        &al,
        tu::example_body(),
        vector::empty<vector<u8>>(),
        tu::example_nonce(),
        &clock_obj,
        ts::ctx(&mut scenario),
    );

    assert!(submission::submitter(&s) == tu::submitter(), 1);
    assert!(submission::form_id(&s) == form::id_address(&form_obj), 2);
    assert!(submission::encrypted_body(&s).length() == tu::example_body().length(), 3);
    assert!(form::submission_count(form::stats(&form_obj)) == 1, 4);

    submission::share(s);
    ts::return_shared(form_obj);
    ts::return_shared(al);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::submission::E_BAD_NONCE)]
fun test_bad_nonce_length_rejects() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (mut form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);
    let al = allowlist::create(&cap, &clock_obj, ts::ctx(&mut scenario));

    // All in one tx — no next_tx needed; nonce length check runs immediately.
    let s = submission::submit(
        &mut form_obj,
        &al,
        tu::example_body(),
        vector::empty<vector<u8>>(),
        b"short", // wrong length — aborts here
        &clock_obj,
        ts::ctx(&mut scenario),
    );

    submission::share(s);
    walform::allowlist::share(al);
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::submission::E_DEADLINE_PASSED)]
fun test_deadline_passed_rejects() {
    let mut scenario = ts::begin(tu::creator());
    let mut clock_obj = tu::make_test_clock(&mut scenario);

    let settings = tu::public_settings_with_limits(0, 100);
    let (mut form_obj, cap) = tu::new_form_with_settings(&mut scenario, &clock_obj, settings);
    let al = allowlist::create(&cap, &clock_obj, ts::ctx(&mut scenario));

    clock::set_for_testing(&mut clock_obj, 101);

    let s = submission::submit(
        &mut form_obj,
        &al,
        tu::example_body(),
        vector::empty<vector<u8>>(),
        tu::example_nonce(),
        &clock_obj,
        ts::ctx(&mut scenario),
    );

    submission::share(s);
    walform::allowlist::share(al);
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::submission::E_SUBMISSION_CAP_REACHED)]
fun test_submission_cap_rejects() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);

    let settings = tu::public_settings_with_limits(1, 0);
    let (mut form_obj, cap) = tu::new_form_with_settings(&mut scenario, &clock_obj, settings);
    let al = allowlist::create(&cap, &clock_obj, ts::ctx(&mut scenario));

    let s1 = submission::submit(
        &mut form_obj, &al,
        tu::example_body(), vector::empty<vector<u8>>(), tu::example_nonce(),
        &clock_obj, ts::ctx(&mut scenario),
    );
    // Second submit — aborts.
    let s2 = submission::submit(
        &mut form_obj, &al,
        tu::example_body(), vector::empty<vector<u8>>(), tu::example_nonce(),
        &clock_obj, ts::ctx(&mut scenario),
    );

    submission::share(s1);
    submission::share(s2);
    walform::allowlist::share(al);
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
fun test_allowlist_submit_succeeds_for_member() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);

    let settings = tu::allowlist_settings(@0x0);
    let (form_obj, cap) = tu::new_form_with_settings(&mut scenario, &clock_obj, settings);

    let mut al = allowlist::create(&cap, &clock_obj, ts::ctx(&mut scenario));
    allowlist::add(&mut al, &cap, tu::submitter());

    form::share(form_obj);
    walform::allowlist::share(al);
    sui::transfer::public_transfer(cap, tu::creator());

    ts::next_tx(&mut scenario, tu::submitter());
    let mut form_obj = ts::take_shared<Form>(&scenario);
    let al = ts::take_shared<Allowlist>(&scenario);

    let s = submission::submit(
        &mut form_obj, &al,
        tu::example_body(), vector::empty<vector<u8>>(), tu::example_nonce(),
        &clock_obj, ts::ctx(&mut scenario),
    );
    assert!(submission::submitter(&s) == tu::submitter(), 1);

    submission::share(s);
    ts::return_shared(form_obj);
    ts::return_shared(al);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::submission::E_NOT_IN_ALLOWLIST)]
fun test_allowlist_submit_rejects_non_member() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);

    let settings = tu::allowlist_settings(@0x0);
    let (form_obj, cap) = tu::new_form_with_settings(&mut scenario, &clock_obj, settings);
    let al = allowlist::create(&cap, &clock_obj, ts::ctx(&mut scenario));
    // NOTE: submitter NOT added to allowlist.

    form::share(form_obj);
    walform::allowlist::share(al);
    sui::transfer::public_transfer(cap, tu::creator());

    ts::next_tx(&mut scenario, tu::submitter());
    let mut form_obj = ts::take_shared<Form>(&scenario);
    let al = ts::take_shared<Allowlist>(&scenario);

    let s = submission::submit(
        &mut form_obj, &al,
        tu::example_body(), vector::empty<vector<u8>>(), tu::example_nonce(),
        &clock_obj, ts::ctx(&mut scenario),
    );

    submission::share(s);
    ts::return_shared(form_obj);
    ts::return_shared(al);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::submission::E_INVALID_ACCESS_MODE)]
fun test_paid_form_rejects_free_submit_path() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);

    let settings = tu::paid_settings(500_000_000);
    let (mut form_obj, cap) = tu::new_form_with_settings(&mut scenario, &clock_obj, settings);
    let al = allowlist::create(&cap, &clock_obj, ts::ctx(&mut scenario));

    let s = submission::submit(
        &mut form_obj, &al,
        tu::example_body(), vector::empty<vector<u8>>(), tu::example_nonce(),
        &clock_obj, ts::ctx(&mut scenario),
    );

    submission::share(s);
    walform::allowlist::share(al);
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
fun test_paid_submit_succeeds_and_bumps_revenue() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);

    let fee = 500_000_000u64;
    let settings = tu::paid_settings(fee);
    let (form_obj, cap) = tu::new_form_with_settings(&mut scenario, &clock_obj, settings);
    let treasury = payment::create(&cap, ts::ctx(&mut scenario));

    form::share(form_obj);
    payment::share(treasury);
    sui::transfer::public_transfer(cap, tu::creator());

    ts::next_tx(&mut scenario, tu::submitter());
    let mut form_obj = ts::take_shared<Form>(&scenario);
    let mut treasury = ts::take_shared<FormTreasury>(&scenario);

    let ctx = ts::ctx(&mut scenario);
    let coin_in = coin::mint_for_testing<SUI>(fee, ctx);
    let s = submission::submit_paid(
        &mut form_obj, &mut treasury,
        coin_in,
        tu::example_body(),
        vector::empty<vector<u8>>(),
        tu::example_nonce(),
        &clock_obj, ctx,
    );

    assert!(submission::submitter(&s) == tu::submitter(), 1);
    assert!(form::submission_count(form::stats(&form_obj)) == 1, 2);
    assert!(payment::balance_value(&treasury) == fee, 3);

    submission::share(s);
    ts::return_shared(form_obj);
    ts::return_shared(treasury);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}
