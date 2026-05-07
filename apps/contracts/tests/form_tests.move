#[test_only]
module walform::form_tests;

use std::string;
use sui::clock::{Self, Clock};
use sui::test_scenario as ts;
use walform::form::{Self, Form};
use walform::form_owner_cap as cap_mod;
use walform::test_utils as tu;

#[test]
fun test_create_and_metadata() {
    let mut scenario = ts::begin(tu::creator());
    let clock = tu::make_test_clock(&mut scenario);
    let (form, cap) = tu::new_public_form(&mut scenario, &clock);

    assert!(form::owner(&form) == tu::creator(), 1);
    assert!(form::schema(&form).length() == tu::example_schema().length(), 2);
    assert!(!form::closed(&form), 3);
    assert!(form::submission_count(form::stats(&form)) == 0, 4);
    assert!(cap_mod::form_id(&cap) == form::id_address(&form), 5);

    clock::destroy_for_testing(clock);
    test_cleanup(form, cap);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::form::E_SCHEMA_TOO_LARGE)]
fun test_schema_too_large_rejects() {
    let mut scenario = ts::begin(tu::creator());
    let clock = tu::make_test_clock(&mut scenario);

    // Allocate a schema bigger than MAX_SCHEMA_BYTES (100 KB).
    let mut big = vector::empty<u8>();
    let mut i = 0u64;
    while (i < form::max_schema_bytes() + 1) {
        big.push_back(0u8);
        i = i + 1;
    };

    let ctx = ts::ctx(&mut scenario);
    let (form, cap) = form::create_form(
        string::utf8(b"Too big"),
        big,
        vector::empty<u8>(),
        tu::public_settings(),
        &clock,
        ctx,
    );

    // unreachable
    clock::destroy_for_testing(clock);
    test_cleanup(form, cap);
    ts::end(scenario);
}

#[test]
fun test_update_schema_works() {
    let mut scenario = ts::begin(tu::creator());
    let clock = tu::make_test_clock(&mut scenario);
    let (mut form, cap) = tu::new_public_form(&mut scenario, &clock);

    let new_schema = b"{\"version\":\"1.0\",\"fields\":[{\"id\":\"x\"}]}";
    form::update_schema(&mut form, &cap, new_schema);

    assert!(form::schema(&form).length() == new_schema.length(), 1);

    clock::destroy_for_testing(clock);
    test_cleanup(form, cap);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::form::E_FORM_CLOSED)]
fun test_update_schema_after_close_rejects() {
    let mut scenario = ts::begin(tu::creator());
    let clock = tu::make_test_clock(&mut scenario);
    let (mut form, cap) = tu::new_public_form(&mut scenario, &clock);

    form::close_form(&mut form, &cap, &clock);
    form::update_schema(&mut form, &cap, b"noop");

    clock::destroy_for_testing(clock);
    test_cleanup(form, cap);
    ts::end(scenario);
}

#[test]
fun test_update_settings_propagates() {
    let mut scenario = ts::begin(tu::creator());
    let clock = tu::make_test_clock(&mut scenario);
    let (mut form, cap) = tu::new_public_form(&mut scenario, &clock);

    let new_settings = tu::public_settings_with_limits(42, 999_999_999);
    form::update_settings(&mut form, &cap, new_settings);

    assert!(form::max_submissions(form::settings(&form)) == 42, 1);
    assert!(form::closes_at_ms(form::settings(&form)) == 999_999_999, 2);

    clock::destroy_for_testing(clock);
    test_cleanup(form, cap);
    ts::end(scenario);
}

#[test]
fun test_id_address_matches_cap() {
    let mut scenario = ts::begin(tu::creator());
    let clock = tu::make_test_clock(&mut scenario);
    let (form, cap) = tu::new_public_form(&mut scenario, &clock);

    assert!(form::id_address(&form) == cap_mod::form_id(&cap), 1);

    clock::destroy_for_testing(clock);
    test_cleanup(form, cap);
    ts::end(scenario);
}

// Stand-in for any keyed object we want to mirror onto a Form via
// set_site_object_id_obj — kept inside the test module so production code
// stays free of test-only types. `store` is required because we sink it via
// `public_transfer` at end-of-test.
public struct DummySite has key, store { id: UID }

#[test]
fun test_set_site_object_id_obj_records_object_id() {
    let mut scenario = ts::begin(tu::creator());
    let clock = tu::make_test_clock(&mut scenario);
    let (mut form, cap) = tu::new_public_form(&mut scenario, &clock);

    let ctx = ts::ctx(&mut scenario);
    let dummy = DummySite { id: object::new(ctx) };
    let dummy_addr = object::id(&dummy).to_address();

    form::set_site_object_id_obj(&mut form, &cap, &dummy);

    assert!(form::site_object_id(&form) == &option::some(dummy_addr), 1);

    sui::transfer::public_transfer(dummy, tu::creator());
    clock::destroy_for_testing(clock);
    test_cleanup(form, cap);
    ts::end(scenario);
}

// Helper: sink a Form + FormOwnerCap at end-of-test. We share the form
// (as the real flow would) and public-transfer the cap to the creator.
fun test_cleanup(form: Form, cap: walform::form_owner_cap::FormOwnerCap) {
    form::share(form);
    sui::transfer::public_transfer(cap, tu::creator());
}
