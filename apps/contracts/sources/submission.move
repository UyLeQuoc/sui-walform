/// Submission — shared object recording one response to a Form.
/// Holds the Seal-encrypted body INLINE per PRD §7.4 (not Walrus). Built-in
/// size/deadline/cap/access-mode checks in submit().
module walform::submission;

use sui::balance;
use sui::clock::{Self, Clock};
use sui::coin::Coin;
use sui::sui::SUI;
use walform::allowlist::{Self, Allowlist};
use walform::events;
use walform::form::{Self, Form};
use walform::payment::{Self, FormTreasury};

// === Constants ===

const MAX_ENCRYPTED_BODY_BYTES: u64 = 200_000; // 200 KB
const MAX_FILE_BLOB_IDS: u64 = 100;
const MAX_FILE_BLOB_ID_BYTES: u64 = 256;
const NONCE_BYTES: u64 = 16;

// === Errors ===

const E_BODY_TOO_LARGE: u64 = 1;
const E_BAD_NONCE: u64 = 2;
const E_FORM_CLOSED: u64 = 3;
const E_DEADLINE_PASSED: u64 = 4;
const E_SUBMISSION_CAP_REACHED: u64 = 5;
const E_NOT_IN_ALLOWLIST: u64 = 6;
const E_WRONG_ALLOWLIST: u64 = 7;
const E_INVALID_ACCESS_MODE: u64 = 8;

// === Struct ===

public struct Submission has key {
    id: UID,
    form_id: address,
    submitter: address,
    /// Seal ciphertext. Size-capped. (See PRD §7.4 / §9.3.)
    encrypted_body: vector<u8>,
    /// Optional Walrus blob IDs for FILE_UPLOAD attachments. Empty for
    /// forms without FILE_UPLOAD blocks.
    file_blob_ids: vector<vector<u8>>,
    /// 16 random bytes — second half of the Seal identity
    /// (first half = form.id_bytes). See seal_policies.move.
    nonce: vector<u8>,
    submitted_at_ms: u64,
}

// === Entry paths — one per access mode ===

/// ACCESS_PUBLIC and ACCESS_ALLOWLIST paths.
/// The allowlist argument is ignored when form is PUBLIC; we still require
/// a dummy allowlist object so the call shape stays uniform on the client
/// side. If you don't have a real allowlist, create a throwaway one and
/// pass it.
public fun submit(
    form: &mut Form,
    allowlist: &Allowlist,
    encrypted_body: vector<u8>,
    file_blob_ids: vector<vector<u8>>,
    nonce: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
): Submission {
    let mode = form::access_mode(form::settings(form));

    // Access-mode gate.
    if (mode == form::access_public()) {
        // No extra checks.
    } else if (mode == form::access_allowlist()) {
        assert!(allowlist::form_id(allowlist) == form::id_address(form), E_WRONG_ALLOWLIST);
        assert!(allowlist::contains(allowlist, ctx.sender()), E_NOT_IN_ALLOWLIST);
    } else if (mode == form::access_token()) {
        // For MVP we don't enforce token-balance on-chain (Move can't easily
        // introspect an arbitrary Coin<T> type without generics). The UI
        // should refuse to submit if the caller doesn't hold the required
        // token. If you need on-chain enforcement, add a dedicated entry fn
        // per token type post-MVP.
    } else if (mode == form::access_paid()) {
        // Paid forms must use submit_paid() — reject here.
        assert!(false, E_INVALID_ACCESS_MODE);
    };

    build_submission(form, encrypted_body, file_blob_ids, nonce, 0, clock, ctx)
}

/// ACCESS_PAID path. Accepts the fee coin and deposits it into the form's treasury.
public fun submit_paid(
    form: &mut Form,
    treasury: &mut FormTreasury,
    fee_coin: Coin<SUI>,
    encrypted_body: vector<u8>,
    file_blob_ids: vector<vector<u8>>,
    nonce: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
): Submission {
    let mode = form::access_mode(form::settings(form));
    assert!(mode == form::access_paid(), E_INVALID_ACCESS_MODE);
    assert!(payment::form_id(treasury) == form::id_address(form), E_WRONG_ALLOWLIST);

    let required = form::submission_fee_mist(form::settings(form));
    let paid = payment::deposit_fee(treasury, fee_coin, required, ctx.sender());

    build_submission(form, encrypted_body, file_blob_ids, nonce, paid, clock, ctx)
}

/// Share a Submission as a shared object. Public so tests and external
/// flows can share from outside the declaring module.
public fun share(s: Submission) { transfer::share_object(s) }

/// Thin wrappers that share-wrap the Submission for typical PTB usage.
public fun submit_and_share(
    form: &mut Form,
    allowlist: &Allowlist,
    encrypted_body: vector<u8>,
    file_blob_ids: vector<vector<u8>>,
    nonce: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let s = submit(form, allowlist, encrypted_body, file_blob_ids, nonce, clock, ctx);
    transfer::share_object(s);
}

public fun submit_paid_and_share(
    form: &mut Form,
    treasury: &mut FormTreasury,
    fee_coin: Coin<SUI>,
    encrypted_body: vector<u8>,
    file_blob_ids: vector<vector<u8>>,
    nonce: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let s = submit_paid(form, treasury, fee_coin, encrypted_body, file_blob_ids, nonce, clock, ctx);
    transfer::share_object(s);
}

// === Shared core ===

fun build_submission(
    form: &mut Form,
    encrypted_body: vector<u8>,
    file_blob_ids: vector<vector<u8>>,
    nonce: vector<u8>,
    paid_mist: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Submission {
    // Size cap — anti-gas-bomb.
    assert!(encrypted_body.length() <= MAX_ENCRYPTED_BODY_BYTES, E_BODY_TOO_LARGE);
    assert_file_blob_ids_capped(&file_blob_ids);
    // Nonce length — required so seal identity math is deterministic.
    assert!(nonce.length() == NONCE_BYTES, E_BAD_NONCE);
    // Form must be open.
    assert!(!form::closed(form), E_FORM_CLOSED);
    // Deadline.
    let now = clock.timestamp_ms();
    let closes_at = form::closes_at_ms(form::settings(form));
    if (closes_at != 0) {
        assert!(now < closes_at, E_DEADLINE_PASSED);
    };
    // Submission cap.
    let cap = form::max_submissions(form::settings(form));
    if (cap != 0) {
        let current = form::submission_count(form::stats(form));
        assert!(current < cap, E_SUBMISSION_CAP_REACHED);
    };

    let uid = object::new(ctx);
    let submission_id = object::uid_to_address(&uid);
    let form_id = form::id_address(form);
    let submitter = ctx.sender();
    let body_len = encrypted_body.length();

    form::bump_stats(form, paid_mist, now);

    events::emit_submission_created(events::new_submission_created(
        form_id, submission_id, submitter, body_len, now,
    ));

    Submission {
        id: uid,
        form_id,
        submitter,
        encrypted_body,
        file_blob_ids,
        nonce,
        submitted_at_ms: now,
    }
}

fun assert_file_blob_ids_capped(file_blob_ids: &vector<vector<u8>>) {
    assert!(file_blob_ids.length() <= MAX_FILE_BLOB_IDS, E_BODY_TOO_LARGE);
    let mut i = 0;
    while (i < file_blob_ids.length()) {
        assert!(file_blob_ids.borrow(i).length() <= MAX_FILE_BLOB_ID_BYTES, E_BODY_TOO_LARGE);
        i = i + 1;
    };
}

// === View helpers (consumed by seal_policies) ===

public fun form_id(s: &Submission): address { s.form_id }
public fun submitter(s: &Submission): address { s.submitter }
public fun encrypted_body(s: &Submission): &vector<u8> { &s.encrypted_body }
public fun file_blob_ids(s: &Submission): &vector<vector<u8>> { &s.file_blob_ids }
public fun nonce(s: &Submission): &vector<u8> { &s.nonce }
public fun submitted_at_ms(s: &Submission): u64 { s.submitted_at_ms }

public fun max_encrypted_body_bytes(): u64 { MAX_ENCRYPTED_BODY_BYTES }
public fun nonce_bytes(): u64 { NONCE_BYTES }
