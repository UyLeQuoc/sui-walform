/// FormTreasury — per-form treasury holding the SUI paid by respondents for
/// ACCESS_PAID forms. Owner-gated withdraw.
module walform::payment;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use walform::events;
use walform::form_owner_cap::{Self, FormOwnerCap};

const E_WRONG_FORM: u64 = 1;
const E_INSUFFICIENT_FEE: u64 = 2;

public struct FormTreasury has key {
    id: UID,
    form_id: address,
    balance: Balance<SUI>,
}

public fun create(cap: &FormOwnerCap, ctx: &mut TxContext): FormTreasury {
    FormTreasury {
        id: object::new(ctx),
        form_id: form_owner_cap::form_id(cap),
        balance: balance::zero(),
    }
}

public fun create_and_share(cap: &FormOwnerCap, ctx: &mut TxContext) {
    let t = create(cap, ctx);
    share(t);
}

/// Share a FormTreasury as a shared object. Module-visible so tests and
/// external flows can share from outside the declaring module.
public fun share(t: FormTreasury) { transfer::share_object(t) }

/// Called from submission.move::submit() for ACCESS_PAID forms.
/// Asserts the payment covers the required fee, takes the whole coin, and
/// joins it into the treasury. Any caller-side change is their responsibility.
public(package) fun deposit_fee(
    treasury: &mut FormTreasury,
    payment: Coin<SUI>,
    required_fee_mist: u64,
    submitter: address,
): u64 {
    let paid = coin::value(&payment);
    assert!(paid >= required_fee_mist, E_INSUFFICIENT_FEE);
    balance::join(&mut treasury.balance, coin::into_balance(payment));
    events::emit_payment_deposited(events::new_payment_deposited(
        treasury.form_id, submitter, paid,
    ));
    paid
}

public fun withdraw(
    treasury: &mut FormTreasury,
    cap: &FormOwnerCap,
    amount_mist: u64,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(form_owner_cap::form_id(cap) == treasury.form_id, E_WRONG_FORM);
    let taken = balance::split(&mut treasury.balance, amount_mist);
    let coin = coin::from_balance(taken, ctx);
    events::emit_payment_withdrawn(events::new_payment_withdrawn(
        treasury.form_id, ctx.sender(), amount_mist,
    ));
    coin
}

public fun withdraw_all(
    treasury: &mut FormTreasury,
    cap: &FormOwnerCap,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(form_owner_cap::form_id(cap) == treasury.form_id, E_WRONG_FORM);
    let amt = balance::value(&treasury.balance);
    withdraw(treasury, cap, amt, ctx)
}

public fun form_id(t: &FormTreasury): address { t.form_id }
public fun balance_value(t: &FormTreasury): u64 { balance::value(&t.balance) }
