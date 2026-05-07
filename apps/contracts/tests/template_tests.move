#[test_only]
module walform::template_tests;

use std::string;
use sui::clock;
use sui::test_scenario as ts;
use walform::form::{Self, Form};
use walform::template::{Self, FormTemplate};
use walform::test_utils as tu;

#[test]
fun test_publish_template_from_form() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    let tags = vector::empty<string::String>();
    let template = template::publish_template(
        &cap,
        &form_obj,
        string::utf8(b"NPS Template"),
        string::utf8(b"Reusable NPS survey"),
        1u8, // category
        option::none(),
        tags,
        &clock_obj,
        ts::ctx(&mut scenario),
    );

    assert!(template::creator(&template) == tu::creator(), 1);
    assert!(template::schema(&template).length() == tu::example_schema().length(), 2);
    assert!(template::clone_count(&template) == 0, 3);
    assert!(template::category(&template) == 1u8, 4);

    sui::transfer::public_transfer(template, tu::creator());
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
fun test_clone_free_copies_schema_and_mints_form() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);

    // Step 1: creator publishes a template.
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);
    let tags = vector::empty<string::String>();
    let template = template::publish_template(
        &cap,
        &form_obj,
        string::utf8(b"Template"),
        string::utf8(b"Desc"),
        0u8,
        option::none(),
        tags,
        &clock_obj,
        ts::ctx(&mut scenario),
    );

    // Place template as a shared object so the next tx (a different buyer) can take it.
    sui::transfer::public_share_object(template);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());

    // Step 2: buyer clones free.
    ts::next_tx(&mut scenario, tu::submitter());
    let mut template = ts::take_shared<FormTemplate>(&scenario);
    let original_schema_len = template::schema(&template).length();
    let original_clone_count = template::clone_count(&template);

    let (new_form, new_cap) = template::clone_free(
        &mut template,
        tu::public_settings(),
        string::utf8(b"My Form Copy"),
        &clock_obj,
        ts::ctx(&mut scenario),
    );

    assert!(form::owner(&new_form) == tu::submitter(), 1);
    assert!(form::schema(&new_form).length() == original_schema_len, 2);
    assert!(template::clone_count(&template) == original_clone_count + 1, 3);

    form::share(new_form);
    sui::transfer::public_transfer(new_cap, tu::submitter());
    ts::return_shared(template);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_royalty_constants() {
    // Sanity check the compile-time constants.
    assert!(template::platform_royalty_bps() == 1000, 1);   // 10%
    assert!(template::platform_min_royalty_mist() == 50_000_000, 2); // 0.05 SUI
}
