#[test_only]
module walform::template_tests;

use std::string;
use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario as ts;
use sui::transfer_policy::TransferPolicy;
use walform::form::{Self, Form};
use walform::template::{Self, FormTemplate, PlatformTreasury, TemplateListing};
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

// === purchase_template_only + record_free_clone tests ===

#[test_only]
fun setup_template_with_listing(scenario: &mut ts::Scenario, price_mist: u64): address {
    // 1. Init template module (creates TransferPolicy + PlatformTreasury).
    template::init_for_testing(ts::ctx(scenario));

    // 2. Creator publishes a template + lists it.
    ts::next_tx(scenario, tu::creator());
    let clock_obj = tu::make_test_clock(scenario);
    let (form_obj, cap) = tu::new_public_form(scenario, &clock_obj);
    let tags = vector::empty<string::String>();
    let template_obj = template::publish_template(
        &cap,
        &form_obj,
        string::utf8(b"T"),
        string::utf8(b"D"),
        0u8,
        option::none(),
        tags,
        &clock_obj,
        ts::ctx(scenario),
    );
    let template_addr = sui::object::id_to_address(&sui::object::id(&template_obj));
    template::create_listing_and_share(&template_obj, price_mist, ts::ctx(scenario));
    sui::transfer::public_share_object(template_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    clock::destroy_for_testing(clock_obj);
    template_addr
}

#[test]
fun test_purchase_template_only_bumps_count_and_emits_no_form() {
    let price: u64 = 1_000_000_000; // 1 SUI
    let mut scenario = ts::begin(tu::creator());
    let _ = setup_template_with_listing(&mut scenario, price);

    // Buyer pays and gets NO Form back.
    ts::next_tx(&mut scenario, tu::submitter());
    let mut template_obj = ts::take_shared<FormTemplate>(&scenario);
    let listing = ts::take_shared<TemplateListing>(&scenario);
    let mut treasury = ts::take_shared<PlatformTreasury>(&scenario);
    let policy = ts::take_shared<TransferPolicy<FormTemplate>>(&scenario);
    let clock_obj = tu::make_test_clock(&mut scenario);

    let before = template::clone_count(&template_obj);
    let payment = coin::mint_for_testing<SUI>(price, ts::ctx(&mut scenario));
    let royalty = coin::mint_for_testing<SUI>(price / 10 + 100_000_000, ts::ctx(&mut scenario));

    template::purchase_template_only(
        &mut template_obj,
        &listing,
        &mut treasury,
        &policy,
        payment,
        royalty,
        &clock_obj,
        ts::ctx(&mut scenario),
    );

    assert!(template::clone_count(&template_obj) == before + 1, 1);

    ts::return_shared(template_obj);
    ts::return_shared(listing);
    ts::return_shared(treasury);
    ts::return_shared(policy);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = 7, location = walform::template)]
fun test_purchase_template_only_rejects_underpayment() {
    let price: u64 = 1_000_000_000;
    let mut scenario = ts::begin(tu::creator());
    let _ = setup_template_with_listing(&mut scenario, price);

    ts::next_tx(&mut scenario, tu::submitter());
    let mut template_obj = ts::take_shared<FormTemplate>(&scenario);
    let listing = ts::take_shared<TemplateListing>(&scenario);
    let mut treasury = ts::take_shared<PlatformTreasury>(&scenario);
    let policy = ts::take_shared<TransferPolicy<FormTemplate>>(&scenario);
    let clock_obj = tu::make_test_clock(&mut scenario);

    // Underpay: 0.5 SUI for a 1 SUI listing.
    let payment = coin::mint_for_testing<SUI>(price / 2, ts::ctx(&mut scenario));
    let royalty = coin::mint_for_testing<SUI>(price, ts::ctx(&mut scenario));

    template::purchase_template_only(
        &mut template_obj,
        &listing,
        &mut treasury,
        &policy,
        payment,
        royalty,
        &clock_obj,
        ts::ctx(&mut scenario),
    );

    // Unreachable — assertion aborts above.
    ts::return_shared(template_obj);
    ts::return_shared(listing);
    ts::return_shared(treasury);
    ts::return_shared(policy);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_record_free_clone_bumps_count() {
    let mut scenario = ts::begin(tu::creator());
    template::init_for_testing(ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);
    let tags = vector::empty<string::String>();
    let template_obj = template::publish_template(
        &cap, &form_obj,
        string::utf8(b"T"), string::utf8(b"D"), 0u8, option::none(), tags,
        &clock_obj, ts::ctx(&mut scenario),
    );
    sui::transfer::public_share_object(template_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());

    // Drafter (a different address) publishes from the template; client calls
    // record_free_clone to bump the marketplace counter.
    ts::next_tx(&mut scenario, tu::submitter());
    let mut template_obj = ts::take_shared<FormTemplate>(&scenario);
    let before = template::clone_count(&template_obj);

    template::record_free_clone(&mut template_obj, &clock_obj, ts::ctx(&mut scenario));

    assert!(template::clone_count(&template_obj) == before + 1, 1);

    ts::return_shared(template_obj);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = 6, location = walform::template)]
fun test_purchase_template_only_rejects_wrong_listing() {
    let price: u64 = 1_000_000_000;
    let mut scenario = ts::begin(tu::creator());
    let template1_addr = setup_template_with_listing(&mut scenario, price);

    // Creator publishes a SECOND template — keep its listing by value (not
    // shared). Feeding listing_2 + template_1 into purchase_template_only
    // must abort with E_WRONG_LISTING (=6).
    ts::next_tx(&mut scenario, tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj2, cap2) = tu::new_public_form(&mut scenario, &clock_obj);
    let tags = vector::empty<string::String>();
    let template_obj2 = template::publish_template(
        &cap2, &form_obj2,
        string::utf8(b"T2"), string::utf8(b"D2"), 0u8, option::none(), tags,
        &clock_obj, ts::ctx(&mut scenario),
    );
    let listing_wrong = template::create_listing(&template_obj2, price, ts::ctx(&mut scenario));
    sui::transfer::public_share_object(template_obj2);
    form::share(form_obj2);
    sui::transfer::public_transfer(cap2, tu::creator());

    ts::next_tx(&mut scenario, tu::submitter());
    // Disambiguate: pick template1 explicitly so listing_wrong (bound to
    // template2) is guaranteed to mismatch.
    let mut template_first = ts::take_shared_by_id<FormTemplate>(
        &scenario,
        sui::object::id_from_address(template1_addr),
    );
    let mut treasury = ts::take_shared<PlatformTreasury>(&scenario);
    let policy = ts::take_shared<TransferPolicy<FormTemplate>>(&scenario);

    let payment = coin::mint_for_testing<SUI>(price, ts::ctx(&mut scenario));
    let royalty = coin::mint_for_testing<SUI>(price, ts::ctx(&mut scenario));

    template::purchase_template_only(
        &mut template_first,
        &listing_wrong,
        &mut treasury,
        &policy,
        payment,
        royalty,
        &clock_obj,
        ts::ctx(&mut scenario),
    );

    // Unreachable — assertion aborts above.
    template::share_listing_for_testing(listing_wrong);
    ts::return_shared(template_first);
    ts::return_shared(treasury);
    ts::return_shared(policy);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}
