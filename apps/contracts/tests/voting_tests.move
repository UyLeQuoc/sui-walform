#[test_only]
module walform::voting_tests;

use std::string;
use sui::clock;
use sui::test_scenario as ts;
use walform::form;
use walform::template::{Self, FormTemplate};
use walform::voting::{Self, TemplateVotes};
use walform::test_utils as tu;

fun publish_and_share_template(
    scenario: &mut ts::Scenario,
    clock_obj: &clock::Clock,
): (address, address) {
    let (form_obj, cap) = tu::new_public_form(scenario, clock_obj);
    let tags = vector::empty<string::String>();
    let template = template::publish_template(
        &cap,
        &form_obj,
        string::utf8(b"Test Template"),
        string::utf8(b"Desc"),
        0u8,
        option::none(),
        tags,
        clock_obj,
        ts::ctx(scenario),
    );
    let template_id = template::id_address(&template);
    // init votes inside the creator's tx (same sender as publish_template).
    voting::init_template_votes(&template, ts::ctx(scenario));
    sui::transfer::public_share_object(template);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    // votes_id is not directly returned — we'll fetch the shared object below.
    (template_id, @0x0)
}

#[test]
fun test_init_then_upvote_increments() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);

    let (template_id, _) = publish_and_share_template(&mut scenario, &clock_obj);
    let _ = template_id;

    // Voter takes the shared TemplateVotes + upvotes.
    ts::next_tx(&mut scenario, tu::submitter());
    let mut votes = ts::take_shared<TemplateVotes>(&scenario);
    assert!(voting::upvotes(&votes) == 0, 1);
    assert!(voting::downvotes(&votes) == 0, 2);
    voting::upvote(&mut votes, ts::ctx(&mut scenario));
    assert!(voting::upvotes(&votes) == 1, 3);
    assert!(voting::downvotes(&votes) == 0, 4);
    assert!(voting::vote_of(&votes, tu::submitter()) == voting::vote_up(), 5);
    ts::return_shared(votes);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_upvote_toggle_off() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (_, _) = publish_and_share_template(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, tu::submitter());
    let mut votes = ts::take_shared<TemplateVotes>(&scenario);
    voting::upvote(&mut votes, ts::ctx(&mut scenario));
    voting::upvote(&mut votes, ts::ctx(&mut scenario));
    assert!(voting::upvotes(&votes) == 0, 1);
    assert!(voting::vote_of(&votes, tu::submitter()) == voting::vote_none(), 2);
    ts::return_shared(votes);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_switch_up_to_down() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (_, _) = publish_and_share_template(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, tu::submitter());
    let mut votes = ts::take_shared<TemplateVotes>(&scenario);
    voting::upvote(&mut votes, ts::ctx(&mut scenario));
    voting::downvote(&mut votes, ts::ctx(&mut scenario));
    assert!(voting::upvotes(&votes) == 0, 1);
    assert!(voting::downvotes(&votes) == 1, 2);
    assert!(voting::vote_of(&votes, tu::submitter()) == voting::vote_down(), 3);
    ts::return_shared(votes);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_clear_vote() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (_, _) = publish_and_share_template(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, tu::submitter());
    let mut votes = ts::take_shared<TemplateVotes>(&scenario);
    voting::upvote(&mut votes, ts::ctx(&mut scenario));
    voting::clear_vote(&mut votes, ts::ctx(&mut scenario));
    assert!(voting::upvotes(&votes) == 0, 1);
    assert!(voting::downvotes(&votes) == 0, 2);
    ts::return_shared(votes);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test]
fun test_two_voters_independent() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (_, _) = publish_and_share_template(&mut scenario, &clock_obj);

    ts::next_tx(&mut scenario, tu::submitter());
    let mut votes = ts::take_shared<TemplateVotes>(&scenario);
    voting::upvote(&mut votes, ts::ctx(&mut scenario));
    ts::return_shared(votes);

    // Different voter
    ts::next_tx(&mut scenario, @0xAAAA);
    let mut votes = ts::take_shared<TemplateVotes>(&scenario);
    voting::downvote(&mut votes, ts::ctx(&mut scenario));
    assert!(voting::upvotes(&votes) == 1, 1);
    assert!(voting::downvotes(&votes) == 1, 2);
    ts::return_shared(votes);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = voting::E_NOT_CREATOR)]
fun test_non_creator_cannot_init() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);

    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);
    let tags = vector::empty<string::String>();
    let template = template::publish_template(
        &cap,
        &form_obj,
        string::utf8(b"T"),
        string::utf8(b"D"),
        0u8,
        option::none(),
        tags,
        &clock_obj,
        ts::ctx(&mut scenario),
    );
    sui::transfer::public_share_object(template);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());

    // Non-creator tries to init votes → must abort.
    ts::next_tx(&mut scenario, tu::submitter());
    let template_ref = ts::take_shared<FormTemplate>(&scenario);
    voting::init_template_votes(&template_ref, ts::ctx(&mut scenario));
    ts::return_shared(template_ref);

    clock::destroy_for_testing(clock_obj);
    ts::end(scenario);
}
