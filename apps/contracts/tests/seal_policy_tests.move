#[test_only]
module walform::seal_policy_tests;

use sui::bcs;
use sui::clock;
use sui::test_scenario as ts;
use walform::allowlist::{Self, Allowlist};
use walform::form::{Self, Form};
use walform::seal_policies;
use walform::submission::{Self, Submission};
use walform::test_utils as tu;

/// Build the well-formed Seal inner identity: form.id_address bytes || nonce bytes.
fun make_identity(form: &Form, submission: &Submission): vector<u8> {
    let mut id = bcs::to_bytes(&form::id_address(form));
    let nonce = submission::nonce(submission);
    let mut i = 0u64;
    while (i < nonce.length()) {
        id.push_back(*nonce.borrow(i));
        i = i + 1;
    };
    id
}

/// Create a form + submit once, leaving the form + submission shared so
/// subsequent txs can take them. Returns nothing; caller uses take_shared.
fun create_form_and_submit(scenario: &mut ts::Scenario, clock_obj: &sui::clock::Clock) {
    let (form_obj, cap) = tu::new_public_form(scenario, clock_obj);
    let al = allowlist::create(&cap, clock_obj, ts::ctx(scenario));
    form::share(form_obj);
    walform::allowlist::share(al);
    sui::transfer::public_transfer(cap, tu::creator());

    ts::next_tx(scenario, tu::submitter());
    let mut form_obj = ts::take_shared<Form>(scenario);
    let al = ts::take_shared<Allowlist>(scenario);
    let s = submission::submit(
        &mut form_obj, &al,
        tu::example_body(), vector::empty<vector<u8>>(), tu::example_nonce(),
        clock_obj, ts::ctx(scenario),
    );
    submission::share(s);
    ts::return_shared(form_obj);
    ts::return_shared(al);
}

#[test]
fun test_creator_can_read() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    create_form_and_submit(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, tu::creator());
    let form_obj = ts::take_shared<Form>(&scenario);
    let submission_obj = ts::take_shared<Submission>(&scenario);

    let id = make_identity(&form_obj, &submission_obj);
    seal_policies::seal_approve_read_submission(id, &form_obj, &submission_obj, ts::ctx(&mut scenario));

    ts::return_shared(form_obj);
    ts::return_shared(submission_obj);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_submitter_can_read() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    create_form_and_submit(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, tu::submitter());
    let form_obj = ts::take_shared<Form>(&scenario);
    let submission_obj = ts::take_shared<Submission>(&scenario);

    let id = make_identity(&form_obj, &submission_obj);
    seal_policies::seal_approve_read_submission(id, &form_obj, &submission_obj, ts::ctx(&mut scenario));

    ts::return_shared(form_obj);
    ts::return_shared(submission_obj);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::seal_policies::E_UNAUTHORIZED)]
fun test_third_party_rejected() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    create_form_and_submit(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, tu::third_party());
    let form_obj = ts::take_shared<Form>(&scenario);
    let submission_obj = ts::take_shared<Submission>(&scenario);

    let id = make_identity(&form_obj, &submission_obj);
    seal_policies::seal_approve_read_submission(id, &form_obj, &submission_obj, ts::ctx(&mut scenario));

    ts::return_shared(form_obj);
    ts::return_shared(submission_obj);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::seal_policies::E_BAD_IDENTITY)]
fun test_wrong_nonce_rejected() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    create_form_and_submit(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, tu::creator());
    let form_obj = ts::take_shared<Form>(&scenario);
    let submission_obj = ts::take_shared<Submission>(&scenario);

    // Right form prefix, wrong suffix.
    let mut id = bcs::to_bytes(&form::id_address(&form_obj));
    let fake_nonce = b"fedcba9876543210"; // 16 bytes, but not the real nonce
    let mut i = 0u64;
    while (i < fake_nonce.length()) {
        id.push_back(*fake_nonce.borrow(i));
        i = i + 1;
    };
    seal_policies::seal_approve_read_submission(id, &form_obj, &submission_obj, ts::ctx(&mut scenario));

    ts::return_shared(form_obj);
    ts::return_shared(submission_obj);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::seal_policies::E_BAD_IDENTITY)]
fun test_wrong_length_rejected() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    create_form_and_submit(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, tu::creator());
    let form_obj = ts::take_shared<Form>(&scenario);
    let submission_obj = ts::take_shared<Submission>(&scenario);

    // Truncated identity (length mismatch).
    let id = b"too-short";
    seal_policies::seal_approve_read_submission(id, &form_obj, &submission_obj, ts::ctx(&mut scenario));

    ts::return_shared(form_obj);
    ts::return_shared(submission_obj);
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_seal_approve_submit_accepts_form_prefix() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);

    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    // Identity for encryption = form_id bytes (no submission yet).
    let id = bcs::to_bytes(&form::id_address(&form_obj));
    seal_policies::seal_approve_submit(id, &form_obj, ts::ctx(&mut scenario));

    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::seal_policies::E_BAD_IDENTITY)]
fun test_seal_approve_submit_rejects_wrong_prefix() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    // Identity with an unrelated form id (all zeros).
    let id = bcs::to_bytes(&@0x0);
    seal_policies::seal_approve_submit(id, &form_obj, ts::ctx(&mut scenario));

    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

// === Seal v2 — schema-level policies ===

#[test]
fun test_read_form_schema_owner_ok() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);
    let al = allowlist::create(&cap, &clock_obj, ts::ctx(&mut scenario));

    let id = bcs::to_bytes(&form::id_address(&form_obj));
    seal_policies::seal_approve_read_form_schema(id, &form_obj, &al, ts::ctx(&mut scenario));

    allowlist::share(al);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_read_form_schema_allowlist_member_ok() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);
    let mut al = allowlist::create(&cap, &clock_obj, ts::ctx(&mut scenario));
    allowlist::add(&mut al, &cap, tu::submitter());
    form::share(form_obj);
    allowlist::share(al);

    ts::next_tx(&mut scenario, tu::submitter());
    let form_shared = ts::take_shared<Form>(&scenario);
    let al_shared = ts::take_shared<Allowlist>(&scenario);

    let id = bcs::to_bytes(&form::id_address(&form_shared));
    seal_policies::seal_approve_read_form_schema(id, &form_shared, &al_shared, ts::ctx(&mut scenario));

    ts::return_shared(form_shared);
    ts::return_shared(al_shared);
    sui::transfer::public_transfer(cap, tu::creator());
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::seal_policies::E_UNAUTHORIZED)]
fun test_read_form_schema_third_party_rejected() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);
    let al = allowlist::create(&cap, &clock_obj, ts::ctx(&mut scenario));
    form::share(form_obj);
    allowlist::share(al);

    ts::next_tx(&mut scenario, tu::third_party());
    let form_shared = ts::take_shared<Form>(&scenario);
    let al_shared = ts::take_shared<Allowlist>(&scenario);

    let id = bcs::to_bytes(&form::id_address(&form_shared));
    seal_policies::seal_approve_read_form_schema(id, &form_shared, &al_shared, ts::ctx(&mut scenario));

    ts::return_shared(form_shared);
    ts::return_shared(al_shared);
    sui::transfer::public_transfer(cap, tu::creator());
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::seal_policies::E_BAD_IDENTITY)]
fun test_read_form_schema_wrong_prefix_rejected() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);
    let al = allowlist::create(&cap, &clock_obj, ts::ctx(&mut scenario));

    // Identity with a different form id.
    let id = bcs::to_bytes(&@0x0);
    seal_policies::seal_approve_read_form_schema(id, &form_obj, &al, ts::ctx(&mut scenario));

    allowlist::share(al);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::seal_policies::E_WRONG_FORM)]
fun test_read_form_schema_wrong_allowlist_rejected() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_a, cap_a) = tu::new_public_form(&mut scenario, &clock_obj);
    let (form_b, cap_b) = tu::new_public_form(&mut scenario, &clock_obj);
    // Allowlist bound to form B, but policy called with form A.
    let al_b = allowlist::create(&cap_b, &clock_obj, ts::ctx(&mut scenario));

    let id = bcs::to_bytes(&form::id_address(&form_a));
    seal_policies::seal_approve_read_form_schema(id, &form_a, &al_b, ts::ctx(&mut scenario));

    allowlist::share(al_b);
    form::share(form_a);
    form::share(form_b);
    sui::transfer::public_transfer(cap_a, tu::creator());
    sui::transfer::public_transfer(cap_b, tu::creator());
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_read_template_schema_creator_ok() {
    use std::string;
    use walform::template::{Self, FormTemplate};

    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    let template = template::publish_template(
        &cap, &form_obj,
        string::utf8(b"Title"), string::utf8(b"Desc"), 0u8,
        option::none(), vector::empty<string::String>(),
        &clock_obj, ts::ctx(&mut scenario),
    );

    let id = bcs::to_bytes(&template::id_address(&template));
    seal_policies::seal_approve_read_template_schema(id, &template, ts::ctx(&mut scenario));

    sui::transfer::public_transfer(template, tu::creator());
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::seal_policies::E_UNAUTHORIZED)]
fun test_read_template_schema_third_party_rejected() {
    use std::string;

    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    let template = walform::template::publish_template(
        &cap, &form_obj,
        string::utf8(b"Title"), string::utf8(b"Desc"), 0u8,
        option::none(), vector::empty<string::String>(),
        &clock_obj, ts::ctx(&mut scenario),
    );
    sui::transfer::public_share_object(template);

    ts::next_tx(&mut scenario, tu::third_party());
    let template_shared = ts::take_shared<walform::template::FormTemplate>(&scenario);

    let id = bcs::to_bytes(&walform::template::id_address(&template_shared));
    seal_policies::seal_approve_read_template_schema(id, &template_shared, ts::ctx(&mut scenario));

    ts::return_shared(template_shared);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}
