#[test_only]
module walform::referral_tests;

use sui::clock::{Self, Clock};
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};
use walform::allowlist::{Self, Allowlist};
use walform::form::{Self, Form};
use walform::payment::{Self, FormTreasury};
use walform::referral;
use walform::submission::{Self, Submission};
use walform::test_utils as tu;

/// Creator shares a public form + its (dummy) allowlist; returns the form id.
fun share_public_form(scenario: &mut Scenario, clock: &Clock): address {
    let (form_obj, cap) = tu::new_public_form(scenario, clock);
    let id = form::id_address(&form_obj);
    let al = allowlist::create(&cap, clock, ts::ctx(scenario));
    form::share(form_obj);
    allowlist::share(al);
    sui::transfer::public_transfer(cap, tu::creator());
    id
}

/// `who` submits to the only shared form, without a referral.
fun plain_submit(scenario: &mut Scenario, clock: &Clock, who: address) {
    ts::next_tx(scenario, who);
    let mut form_obj = ts::take_shared<Form>(scenario);
    let al = ts::take_shared<Allowlist>(scenario);
    submission::submit_and_share(
        &mut form_obj,
        &al,
        tu::example_body(),
        vector[],
        tu::example_nonce(),
        clock,
        ts::ctx(scenario),
    );
    ts::return_shared(form_obj);
    ts::return_shared(al);
}

#[test]
fun test_referral_submit_records_and_shares() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    share_public_form(&mut scenario, &clock_obj);
    plain_submit(&mut scenario, &clock_obj, tu::submitter());

    // third_party arrives through submitter's link.
    ts::next_tx(&mut scenario, tu::third_party());
    let mut form_obj = ts::take_shared<Form>(&scenario);
    let al = ts::take_shared<Allowlist>(&scenario);
    let referrer = ts::take_shared<Submission>(&scenario);
    referral::submit_and_share(
        &mut form_obj,
        &al,
        &referrer,
        tu::example_body(),
        vector[],
        tu::example_nonce(),
        &clock_obj,
        ts::ctx(&mut scenario),
    );
    assert!(form::submission_count(form::stats(&form_obj)) == 2, 1);
    ts::return_shared(form_obj);
    ts::return_shared(al);
    ts::return_shared(referrer);

    // SubmissionCreated + ReferralRecorded, and exactly one new object (the Submission).
    let effects = ts::next_tx(&mut scenario, tu::creator());
    assert!(ts::num_user_events(&effects) == 2, 2);
    assert!(ts::created(&effects).length() == 1, 3);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::referral::E_SELF_REFERRAL)]
fun test_self_referral_rejects() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    share_public_form(&mut scenario, &clock_obj);
    plain_submit(&mut scenario, &clock_obj, tu::submitter());

    // submitter uses their own link.
    ts::next_tx(&mut scenario, tu::submitter());
    let mut form_obj = ts::take_shared<Form>(&scenario);
    let al = ts::take_shared<Allowlist>(&scenario);
    let referrer = ts::take_shared<Submission>(&scenario);
    referral::submit_and_share(
        &mut form_obj,
        &al,
        &referrer,
        tu::example_body(),
        vector[],
        tu::example_nonce(),
        &clock_obj,
        ts::ctx(&mut scenario),
    );

    ts::return_shared(form_obj);
    ts::return_shared(al);
    ts::return_shared(referrer);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::referral::E_REFERRER_WRONG_FORM)]
fun test_referrer_from_another_form_rejects() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);

    // Form A gets a submission from submitter.
    let (mut form_a, cap_a) = tu::new_public_form(&mut scenario, &clock_obj);
    let al_a = allowlist::create(&cap_a, &clock_obj, ts::ctx(&mut scenario));
    let s = submission::submit(
        &mut form_a,
        &al_a,
        tu::example_body(),
        vector[],
        tu::example_nonce(),
        &clock_obj,
        ts::ctx(&mut scenario),
    );
    let referrer_id = object::id(&s);
    submission::share(s);

    // Form B is a different form.
    let (mut form_b, cap_b) = tu::new_public_form(&mut scenario, &clock_obj);
    let al_b = allowlist::create(&cap_b, &clock_obj, ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, tu::third_party());
    let referrer = ts::take_shared_by_id<Submission>(&scenario, referrer_id);
    referral::submit_and_share(
        &mut form_b,
        &al_b,
        &referrer,
        tu::example_body(),
        vector[],
        tu::example_nonce(),
        &clock_obj,
        ts::ctx(&mut scenario),
    );

    ts::return_shared(referrer);
    form::share(form_a);
    form::share(form_b);
    allowlist::share(al_a);
    allowlist::share(al_b);
    sui::transfer::public_transfer(cap_a, tu::creator());
    sui::transfer::public_transfer(cap_b, tu::creator());
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_paid_referral_submit_records() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let fee = 500_000_000u64;
    let (form_obj, cap) = tu::new_form_with_settings(
        &mut scenario,
        &clock_obj,
        tu::paid_settings(fee),
    );
    let treasury = payment::create(&cap, ts::ctx(&mut scenario));
    form::share(form_obj);
    payment::share(treasury);
    sui::transfer::public_transfer(cap, tu::creator());

    // submitter pays and submits.
    ts::next_tx(&mut scenario, tu::submitter());
    let mut form_obj = ts::take_shared<Form>(&scenario);
    let mut treasury = ts::take_shared<FormTreasury>(&scenario);
    let coin_in = coin::mint_for_testing<SUI>(fee, ts::ctx(&mut scenario));
    submission::submit_paid_and_share(
        &mut form_obj,
        &mut treasury,
        coin_in,
        tu::example_body(),
        vector[],
        tu::example_nonce(),
        &clock_obj,
        ts::ctx(&mut scenario),
    );
    ts::return_shared(form_obj);
    ts::return_shared(treasury);

    // third_party pays through submitter's link.
    ts::next_tx(&mut scenario, tu::third_party());
    let mut form_obj = ts::take_shared<Form>(&scenario);
    let mut treasury = ts::take_shared<FormTreasury>(&scenario);
    let referrer = ts::take_shared<Submission>(&scenario);
    let coin_in = coin::mint_for_testing<SUI>(fee, ts::ctx(&mut scenario));
    referral::submit_paid_and_share(
        &mut form_obj,
        &mut treasury,
        coin_in,
        &referrer,
        tu::example_body(),
        vector[],
        tu::example_nonce(),
        &clock_obj,
        ts::ctx(&mut scenario),
    );
    assert!(form::submission_count(form::stats(&form_obj)) == 2, 1);
    assert!(payment::balance_value(&treasury) == 2 * fee, 2);
    ts::return_shared(form_obj);
    ts::return_shared(treasury);
    ts::return_shared(referrer);

    let effects = ts::next_tx(&mut scenario, tu::creator());
    assert!(ts::num_user_events(&effects) >= 2, 3);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}
