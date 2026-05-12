/// FormReviewers — one shared set of addresses per Form that can decrypt
/// submissions alongside the form's owner. Used to share decrypt rights
/// with hackathon judges, co-admins, or trusted teammates without giving up
/// the FormOwnerCap (which still gates writes like close/withdraw/update).
///
/// Permission model:
///   - Owner OR any existing reviewer can ADD a new reviewer.
///   - ONLY the owner (via FormOwnerCap) can REMOVE a reviewer.
///   - Reviewers can decrypt submissions via
///     `seal_policies::seal_approve_read_submission_with_reviewers`.
///   - Reviewers do NOT inherit owner write rights (close, treasury, schema
///     update, etc.) — those stay cap-gated.
module walform::reviewers;

use sui::event;
use sui::vec_set::{Self, VecSet};
use walform::form::{Self, Form};
use walform::form_owner_cap::{Self, FormOwnerCap};

// === Errors ===

const E_NOT_ALLOWED: u64 = 1;
const E_WRONG_FORM: u64 = 2;

// === Structs ===

public struct FormReviewers has key {
    id: UID,
    form_id: address,
    /// Cached at init so add_reviewer doesn't need `&Form` to verify the
    /// caller — owner identity never changes for an existing form.
    owner: address,
    members: VecSet<address>,
}

// === Events ===

public struct ReviewersCreated has copy, drop {
    form_id: address,
    reviewers_id: address,
    owner: address,
}

public struct ReviewerAdded has copy, drop {
    form_id: address,
    reviewers_id: address,
    by: address,
    member: address,
}

public struct ReviewerRemoved has copy, drop {
    form_id: address,
    reviewers_id: address,
    by: address,
    member: address,
}

// === Init ===

/// Owner-gated. Creates and shares the tracker. Called atomically inside
/// the publish PTBs so every fresh form ships with an empty reviewer set.
public fun create_and_share(cap: &FormOwnerCap, form: &Form, ctx: &mut TxContext) {
    let form_id = form::id_address(form);
    form_owner_cap::assert_for(cap, form_id);

    let reviewers = FormReviewers {
        id: object::new(ctx),
        form_id,
        owner: form::owner(form),
        members: vec_set::empty(),
    };
    let reviewers_id = object::uid_to_address(&reviewers.id);
    event::emit(ReviewersCreated {
        form_id,
        reviewers_id,
        owner: reviewers.owner,
    });
    transfer::share_object(reviewers);
}

// === Mutations ===

/// Add a reviewer. Permitted when the caller is the form owner OR already a
/// reviewer (peer-invite model). Idempotent — adding an already-member is a
/// no-op.
public fun add_reviewer(reviewers: &mut FormReviewers, new_member: address, ctx: &TxContext) {
    let caller = ctx.sender();
    let is_owner = caller == reviewers.owner;
    let is_reviewer = vec_set::contains(&reviewers.members, &caller);
    assert!(is_owner || is_reviewer, E_NOT_ALLOWED);

    if (vec_set::contains(&reviewers.members, &new_member)) return;
    vec_set::insert(&mut reviewers.members, new_member);

    event::emit(ReviewerAdded {
        form_id: reviewers.form_id,
        reviewers_id: object::uid_to_address(&reviewers.id),
        by: caller,
        member: new_member,
    });
}

/// Remove a reviewer. Owner-only — proven by FormOwnerCap matching the
/// tracker's form_id. Reviewers cannot kick each other.
public fun remove_reviewer(
    cap: &FormOwnerCap,
    reviewers: &mut FormReviewers,
    member: address,
    ctx: &TxContext,
) {
    form_owner_cap::assert_for(cap, reviewers.form_id);
    if (!vec_set::contains(&reviewers.members, &member)) return;
    vec_set::remove(&mut reviewers.members, &member);
    event::emit(ReviewerRemoved {
        form_id: reviewers.form_id,
        reviewers_id: object::uid_to_address(&reviewers.id),
        by: ctx.sender(),
        member,
    });
}

// === Views ===

public fun form_id(r: &FormReviewers): address { r.form_id }
public fun owner(r: &FormReviewers): address { r.owner }
public fun members(r: &FormReviewers): &VecSet<address> { &r.members }
public fun is_reviewer(r: &FormReviewers, who: address): bool {
    vec_set::contains(&r.members, &who)
}
public fun member_count(r: &FormReviewers): u64 {
    vec_set::size(&r.members)
}

// === Cross-module helper (consumed by seal_policies) ===

/// Assert that `reviewers` is bound to `form`. Used inside seal policy entry
/// fns so they can take both as args and verify the pairing.
public(package) fun assert_for_form(reviewers: &FormReviewers, expected_form_id: address) {
    assert!(reviewers.form_id == expected_form_id, E_WRONG_FORM);
}

// Expose error codes for tests.
public fun e_not_allowed(): u64 { E_NOT_ALLOWED }
public fun e_wrong_form(): u64 { E_WRONG_FORM }
