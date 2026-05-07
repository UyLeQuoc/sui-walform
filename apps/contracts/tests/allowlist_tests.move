#[test_only]
module walform::allowlist_tests;

use sui::clock;
use sui::event;
use sui::test_scenario as ts;
use walform::allowlist::{Self, Allowlist};
use walform::form;
use walform::test_utils as tu;

#[test]
fun test_add_and_contains() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    let ctx = ts::ctx(&mut scenario);
    let mut al = allowlist::create(&cap, &clock_obj, ctx);

    assert!(allowlist::size(&al) == 0, 1);
    allowlist::add(&mut al, &cap, tu::submitter());
    assert!(allowlist::size(&al) == 1, 2);
    assert!(allowlist::contains(&al, tu::submitter()), 3);
    assert!(!allowlist::contains(&al, tu::third_party()), 4);

    walform::allowlist::share(al);
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::allowlist::E_ALREADY_MEMBER)]
fun test_duplicate_add_rejects() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    let ctx = ts::ctx(&mut scenario);
    let mut al = allowlist::create(&cap, &clock_obj, ctx);

    allowlist::add(&mut al, &cap, tu::submitter());
    allowlist::add(&mut al, &cap, tu::submitter()); // aborts

    walform::allowlist::share(al);
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::allowlist::E_NOT_MEMBER)]
fun test_remove_nonexistent_rejects() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    let ctx = ts::ctx(&mut scenario);
    let mut al = allowlist::create(&cap, &clock_obj, ctx);
    allowlist::remove(&mut al, &cap, tu::submitter()); // aborts

    walform::allowlist::share(al);
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
fun test_add_many_skips_duplicates() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    let ctx = ts::ctx(&mut scenario);
    let mut al = allowlist::create(&cap, &clock_obj, ctx);

    let mut batch = vector::empty<address>();
    batch.push_back(tu::submitter());
    batch.push_back(tu::third_party());
    batch.push_back(tu::submitter()); // duplicate — should be skipped
    allowlist::add_many(&mut al, &cap, batch);

    assert!(allowlist::size(&al) == 2, 1);
    assert!(allowlist::contains(&al, tu::submitter()), 2);
    assert!(allowlist::contains(&al, tu::third_party()), 3);

    walform::allowlist::share(al);
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
fun test_create_emits_allowlist_created_event() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    let ctx = ts::ctx(&mut scenario);
    let al = allowlist::create(&cap, &clock_obj, ctx);

    let events = event::events_by_type<walform::events::AllowlistCreated>();
    assert!(events.length() == 1, 1);

    walform::allowlist::share(al);
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
fun test_remove_and_readd() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    let ctx = ts::ctx(&mut scenario);
    let mut al = allowlist::create(&cap, &clock_obj, ctx);

    allowlist::add(&mut al, &cap, tu::submitter());
    allowlist::remove(&mut al, &cap, tu::submitter());
    assert!(!allowlist::contains(&al, tu::submitter()), 1);
    allowlist::add(&mut al, &cap, tu::submitter());
    assert!(allowlist::contains(&al, tu::submitter()), 2);

    walform::allowlist::share(al);
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}
