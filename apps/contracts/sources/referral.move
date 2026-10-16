/// Referral links — added by a compatible upgrade.
///
/// A respondent who already submitted shares a link carrying their
/// `Submission` id. Someone submitting through it calls one of the wrappers
/// below instead of `submission::submit_and_share`: the new Submission is
/// created exactly as before, and the referral is recorded only after the
/// referrer's Submission proves they answered this same form (and isn't the
/// new respondent themselves).
///
/// Recording happens only here, at creation, so a referral can't be added to
/// an existing Submission or recorded twice for one.
///
/// `ReferralRecorded` was introduced by this upgrade, so its type is tagged
/// with the package version that introduced it, not `originalPackageId`.
module walform::referral;

use sui::clock::Clock;
use sui::coin::Coin;
use sui::event;
use sui::sui::SUI;
use walform::allowlist::Allowlist;
use walform::form::Form;
use walform::payment::FormTreasury;
use walform::submission::{Self, Submission};

// === Errors ===

const E_REFERRER_WRONG_FORM: u64 = 1;
const E_SELF_REFERRAL: u64 = 2;

// === Events ===

public struct ReferralRecorded has copy, drop {
    form_id: address,
    /// The new Submission.
    submission_id: address,
    submitter: address,
    /// Who shared the link — the referrer Submission's submitter.
    referrer: address,
    referrer_submission_id: address,
    submitted_at_ms: u64,
}

// === Submit through a referral link ===

/// `submission::submit_and_share` (public / allowlist / token forms), crediting `referrer`.
public fun submit_and_share(
    form: &mut Form,
    allowlist: &Allowlist,
    referrer: &Submission,
    encrypted_body: vector<u8>,
    file_blob_ids: vector<vector<u8>>,
    nonce: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let s = submission::submit(form, allowlist, encrypted_body, file_blob_ids, nonce, clock, ctx);
    record(&s, referrer);
    submission::share(s);
}

/// `submission::submit_paid_and_share` (paid forms), crediting `referrer`.
public fun submit_paid_and_share(
    form: &mut Form,
    treasury: &mut FormTreasury,
    fee_coin: Coin<SUI>,
    referrer: &Submission,
    encrypted_body: vector<u8>,
    file_blob_ids: vector<vector<u8>>,
    nonce: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let s = submission::submit_paid(
        form,
        treasury,
        fee_coin,
        encrypted_body,
        file_blob_ids,
        nonce,
        clock,
        ctx,
    );
    record(&s, referrer);
    submission::share(s);
}

fun record(s: &Submission, referrer: &Submission) {
    assert!(submission::form_id(referrer) == submission::form_id(s), E_REFERRER_WRONG_FORM);
    assert!(submission::submitter(referrer) != submission::submitter(s), E_SELF_REFERRAL);
    event::emit(ReferralRecorded {
        form_id: submission::form_id(s),
        submission_id: object::id_address(s),
        submitter: submission::submitter(s),
        referrer: submission::submitter(referrer),
        referrer_submission_id: object::id_address(referrer),
        submitted_at_ms: submission::submitted_at_ms(s),
    });
}
