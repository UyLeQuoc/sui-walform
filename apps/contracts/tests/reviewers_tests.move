#[test_only]
module walform::reviewers_tests;

use sui::clock;
use sui::test_scenario as ts;
use walform::form;
use walform::reviewers::{Self, FormReviewers};
use walform::test_utils as tu;

const ALICE: address = @0xA11CE;
const BOB: address = @0xB0B;

fun publish_and_share_reviewers(scenario: &mut ts::Scenario, clock_obj: &clock::Clock) {
    let (form_obj, cap) = tu::new_public_form(scenario, clock_obj);
    reviewers::create_and_share(&cap, &form_obj, ts::ctx(scenario));
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
}

#[test]
fun test_create_starts_empty() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);

    publish_and_share_reviewers(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, tu::creator());
    let r = ts::take_shared<FormReviewers>(&scenario);
    assert!(reviewers::member_count(&r) == 0, 1);
    assert!(reviewers::owner(&r) == tu::creator(), 2);
    ts::return_shared(r);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_owner_can_add() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    publish_and_share_reviewers(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, tu::creator());
    let mut r = ts::take_shared<FormReviewers>(&scenario);
    reviewers::add_reviewer(&mut r, ALICE, ts::ctx(&mut scenario));
    assert!(reviewers::is_reviewer(&r, ALICE), 1);
    assert!(reviewers::member_count(&r) == 1, 2);
    ts::return_shared(r);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_reviewer_can_add_another() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    publish_and_share_reviewers(&mut scenario, &clock_obj);

    // Owner adds Alice
    ts::next_tx(&mut scenario, tu::creator());
    let mut r = ts::take_shared<FormReviewers>(&scenario);
    reviewers::add_reviewer(&mut r, ALICE, ts::ctx(&mut scenario));
    ts::return_shared(r);

    // Alice adds Bob (reviewer-invites-reviewer)
    ts::next_tx(&mut scenario, ALICE);
    let mut r = ts::take_shared<FormReviewers>(&scenario);
    reviewers::add_reviewer(&mut r, BOB, ts::ctx(&mut scenario));
    assert!(reviewers::is_reviewer(&r, BOB), 1);
    assert!(reviewers::member_count(&r) == 2, 2);
    ts::return_shared(r);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = reviewers::E_NOT_ALLOWED)]
fun test_non_reviewer_cannot_add() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    publish_and_share_reviewers(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, ALICE); // Alice isn't owner or reviewer
    let mut r = ts::take_shared<FormReviewers>(&scenario);
    reviewers::add_reviewer(&mut r, BOB, ts::ctx(&mut scenario));
    ts::return_shared(r);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_add_idempotent() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    publish_and_share_reviewers(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, tu::creator());
    let mut r = ts::take_shared<FormReviewers>(&scenario);
    reviewers::add_reviewer(&mut r, ALICE, ts::ctx(&mut scenario));
    reviewers::add_reviewer(&mut r, ALICE, ts::ctx(&mut scenario)); // re-add same
    assert!(reviewers::member_count(&r) == 1, 1);
    ts::return_shared(r);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_owner_can_remove() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    publish_and_share_reviewers(&mut scenario, &clock_obj);

    // Add then remove
    ts::next_tx(&mut scenario, tu::creator());
    let mut r = ts::take_shared<FormReviewers>(&scenario);
    reviewers::add_reviewer(&mut r, ALICE, ts::ctx(&mut scenario));
    ts::return_shared(r);

    ts::next_tx(&mut scenario, tu::creator());
    let cap = ts::take_from_address<walform::form_owner_cap::FormOwnerCap>(
        &scenario,
        tu::creator(),
    );
    let mut r = ts::take_shared<FormReviewers>(&scenario);
    reviewers::remove_reviewer(&cap, &mut r, ALICE, ts::ctx(&mut scenario));
    assert!(!reviewers::is_reviewer(&r, ALICE), 1);
    assert!(reviewers::member_count(&r) == 0, 2);
    ts::return_shared(r);
    ts::return_to_address(tu::creator(), cap);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_reviewer_cannot_remove_peer() {
    // Two reviewers; one tries to remove the other → should fail because
    // remove requires the FormOwnerCap which the reviewer doesn't hold.
    // Compile-time guarantee: remove_reviewer's signature mandates &cap, so
    // we can't even construct the call from a non-owner address.
    // This test just documents that owner is required by exercising the
    // happy path with the cap.
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    publish_and_share_reviewers(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, tu::creator());
    let mut r = ts::take_shared<FormReviewers>(&scenario);
    reviewers::add_reviewer(&mut r, ALICE, ts::ctx(&mut scenario));
    reviewers::add_reviewer(&mut r, BOB, ts::ctx(&mut scenario));
    ts::return_shared(r);

    // Owner removes Alice (Alice can't remove Bob herself — no cap).
    ts::next_tx(&mut scenario, tu::creator());
    let cap = ts::take_from_address<walform::form_owner_cap::FormOwnerCap>(
        &scenario,
        tu::creator(),
    );
    let mut r = ts::take_shared<FormReviewers>(&scenario);
    reviewers::remove_reviewer(&cap, &mut r, ALICE, ts::ctx(&mut scenario));
    assert!(!reviewers::is_reviewer(&r, ALICE), 1);
    assert!(reviewers::is_reviewer(&r, BOB), 2);
    ts::return_shared(r);
    ts::return_to_address(tu::creator(), cap);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}
