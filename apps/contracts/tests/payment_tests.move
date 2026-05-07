#[test_only]
module walform::payment_tests;

use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;
use walform::form;
use walform::payment::{Self, FormTreasury};
use walform::test_utils as tu;

#[test]
fun test_deposit_and_withdraw() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    let ctx = ts::ctx(&mut scenario);
    let mut treasury = payment::create(&cap, ctx);

    // Mint a 1 SUI coin and deposit as a 0.5 SUI fee — overpayment is allowed.
    let coin1 = coin::mint_for_testing<SUI>(1_000_000_000, ctx);
    let paid = payment::deposit_fee(&mut treasury, coin1, 500_000_000, tu::submitter());
    assert!(paid == 1_000_000_000, 1);
    assert!(payment::balance_value(&treasury) == 1_000_000_000, 2);

    let withdrawn = payment::withdraw(&mut treasury, &cap, 400_000_000, ts::ctx(&mut scenario));
    assert!(coin::value(&withdrawn) == 400_000_000, 3);
    assert!(payment::balance_value(&treasury) == 600_000_000, 4);

    coin::burn_for_testing(withdrawn);
    payment::share(treasury);
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::payment::E_INSUFFICIENT_FEE)]
fun test_insufficient_fee_rejects() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    let ctx = ts::ctx(&mut scenario);
    let mut treasury = payment::create(&cap, ctx);

    let coin_short = coin::mint_for_testing<SUI>(100, ctx);
    let _ = payment::deposit_fee(&mut treasury, coin_short, 1_000_000, tu::submitter()); // aborts

    payment::share(treasury);
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
fun test_withdraw_all_drains_balance() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);
    let (form_obj, cap) = tu::new_public_form(&mut scenario, &clock_obj);

    let ctx = ts::ctx(&mut scenario);
    let mut treasury = payment::create(&cap, ctx);

    let c = coin::mint_for_testing<SUI>(777_000, ctx);
    let _ = payment::deposit_fee(&mut treasury, c, 0, tu::submitter());
    assert!(payment::balance_value(&treasury) == 777_000, 1);

    let all = payment::withdraw_all(&mut treasury, &cap, ts::ctx(&mut scenario));
    assert!(coin::value(&all) == 777_000, 2);
    assert!(payment::balance_value(&treasury) == 0, 3);

    coin::burn_for_testing(all);
    payment::share(treasury);
    clock::destroy_for_testing(clock_obj);
    form::share(form_obj);
    sui::transfer::public_transfer(cap, tu::creator());
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = walform::payment::E_WRONG_FORM)]
fun test_withdraw_with_wrong_cap_rejects() {
    let mut scenario = ts::begin(tu::creator());
    let clock_obj = tu::make_test_clock(&mut scenario);

    // Two forms — two caps. Treasury belongs to form A; try to withdraw with cap B.
    let (form_a, cap_a) = tu::new_public_form(&mut scenario, &clock_obj);
    let (form_b, cap_b) = tu::new_public_form(&mut scenario, &clock_obj);

    let ctx = ts::ctx(&mut scenario);
    let mut treasury = payment::create(&cap_a, ctx);

    let c = coin::mint_for_testing<SUI>(100, ctx);
    let _ = payment::deposit_fee(&mut treasury, c, 0, tu::submitter());

    let bad = payment::withdraw(&mut treasury, &cap_b, 50, ts::ctx(&mut scenario)); // aborts

    coin::burn_for_testing(bad);
    payment::share(treasury);
    clock::destroy_for_testing(clock_obj);
    form::share(form_a);
    form::share(form_b);
    sui::transfer::public_transfer(cap_a, tu::creator());
    sui::transfer::public_transfer(cap_b, tu::creator());
    ts::end(scenario);
}
