/// Template upvote/downvote — one vote per voter per template, stored as a
/// dynamic field on a shared `TemplateVotes` object keyed by voter address.
/// Toggle semantics: calling `upvote` twice clears the up-vote; calling
/// `downvote` after `upvote` switches sides.
///
/// `TemplateVotes` is created lazily by the template creator. The publish
/// PTBs fold `init_template_votes` in atomically so every fresh template ships
/// with a tracker. Pre-feature templates can be initialized by their creator
/// post-hoc — voting is the same call either way.
module walform::voting;

use sui::dynamic_field as df;
use sui::event;
use walform::template::{Self, FormTemplate};

// === Errors ===

const E_NOT_CREATOR: u64 = 1;

// === Vote values ===

const VOTE_NONE: u8 = 0;
const VOTE_UP: u8 = 1;
const VOTE_DOWN: u8 = 2;

// === Structs ===

public struct TemplateVotes has key {
    id: UID,
    template_id: address,
    upvotes: u64,
    downvotes: u64,
}

/// Dynamic field value stored on `TemplateVotes.id` keyed by voter address.
public struct VoteRecord has copy, drop, store {
    value: u8,
}

// === Events ===

public struct TemplateVotesInitialized has copy, drop {
    template_id: address,
    votes_id: address,
}

public struct VoteCast has copy, drop {
    template_id: address,
    voter: address,
    /// 0 = cleared (toggled-off), 1 = up, 2 = down
    value: u8,
    upvotes: u64,
    downvotes: u64,
}

// === Init ===

/// Creator-only. Creates a shared `TemplateVotes` for the given template.
/// Emits `TemplateVotesInitialized` so clients can discover the tracker.
///
/// Permissionless via re-call is technically possible (creator could create
/// duplicates), but clients dedupe by picking the earliest event per
/// template_id. Wasted gas, no functional issue.
public fun init_template_votes(template: &FormTemplate, ctx: &mut TxContext) {
    assert!(template::creator(template) == ctx.sender(), E_NOT_CREATOR);
    let votes = TemplateVotes {
        id: object::new(ctx),
        template_id: template::id_address(template),
        upvotes: 0,
        downvotes: 0,
    };
    event::emit(TemplateVotesInitialized {
        template_id: votes.template_id,
        votes_id: object::uid_to_address(&votes.id),
    });
    transfer::share_object(votes);
}

// === Vote actions ===

/// Cast (or toggle off) an up-vote.
public fun upvote(votes: &mut TemplateVotes, ctx: &TxContext) {
    set_vote(votes, VOTE_UP, ctx);
}

/// Cast (or toggle off) a down-vote.
public fun downvote(votes: &mut TemplateVotes, ctx: &TxContext) {
    set_vote(votes, VOTE_DOWN, ctx);
}

/// Clear the caller's vote (whichever side).
public fun clear_vote(votes: &mut TemplateVotes, ctx: &TxContext) {
    set_vote(votes, VOTE_NONE, ctx);
}

fun set_vote(votes: &mut TemplateVotes, intent: u8, ctx: &TxContext) {
    let voter = ctx.sender();
    let existing_value = remove_existing(votes, voter);
    // Click-same-button = toggle off.
    let final_value = if (intent == existing_value) VOTE_NONE else intent;
    if (final_value == VOTE_UP) {
        df::add(&mut votes.id, voter, VoteRecord { value: VOTE_UP });
        votes.upvotes = votes.upvotes + 1;
    } else if (final_value == VOTE_DOWN) {
        df::add(&mut votes.id, voter, VoteRecord { value: VOTE_DOWN });
        votes.downvotes = votes.downvotes + 1;
    };
    event::emit(VoteCast {
        template_id: votes.template_id,
        voter,
        value: final_value,
        upvotes: votes.upvotes,
        downvotes: votes.downvotes,
    });
}

fun remove_existing(votes: &mut TemplateVotes, voter: address): u8 {
    if (!df::exists_<address>(&votes.id, voter)) {
        return VOTE_NONE
    };
    let removed: VoteRecord = df::remove<address, VoteRecord>(&mut votes.id, voter);
    if (removed.value == VOTE_UP) {
        votes.upvotes = votes.upvotes - 1;
    } else if (removed.value == VOTE_DOWN) {
        votes.downvotes = votes.downvotes - 1;
    };
    removed.value
}

// === View helpers ===

public fun template_id(v: &TemplateVotes): address { v.template_id }
public fun upvotes(v: &TemplateVotes): u64 { v.upvotes }
public fun downvotes(v: &TemplateVotes): u64 { v.downvotes }

/// Returns the caller's current vote on this template: 0 / 1 / 2.
public fun vote_of(v: &TemplateVotes, voter: address): u8 {
    if (!df::exists_<address>(&v.id, voter)) {
        return VOTE_NONE
    };
    let r: &VoteRecord = df::borrow<address, VoteRecord>(&v.id, voter);
    r.value
}

public fun vote_none(): u8 { VOTE_NONE }
public fun vote_up(): u8 { VOTE_UP }
public fun vote_down(): u8 { VOTE_DOWN }
