/// Seal approval policies — whitelist pattern (creator + submitter only).
///
/// Seal identities are [namespace][inner_id] where the SDK prepends the
/// `originalPackageId` automatically; on-chain `seal_approve*` functions
/// only see the inner_id. We layout inner_id as:
///
///   bytes  0..32  = form.id_address (32 BCS-encoded address bytes)
///   bytes 32..48  = submission.nonce (16 random bytes)
///   total         = 48 bytes
///
/// See PRD §8.3 + §9.3, and Mysten's reference pattern at
/// https://github.com/MystenLabs/seal/blob/main/move/patterns/whitelist.move
module walform::seal_policies;

use walform::allowlist::{Self, Allowlist};
use walform::form::{Self, Form};
use walform::reviewers::{Self, FormReviewers};
use walform::submission::{Self, Submission};
use walform::template::{Self, FormTemplate};

const E_BAD_IDENTITY: u64 = 1;
const E_UNAUTHORIZED: u64 = 2;
const E_WRONG_FORM: u64 = 3;

fun check_read_identity(id: &vector<u8>, form: &Form, submission: &Submission): bool {
    // Submission must belong to this form.
    if (submission::form_id(submission) != form::id_address(form)) return false;

    let form_bytes = sui::bcs::to_bytes(&form::id_address(form));
    let nonce_ref = submission::nonce(submission);
    let expected_len = form_bytes.length() + nonce_ref.length();
    if (id.length() != expected_len) return false;

    // Prefix — form id
    let mut i = 0;
    while (i < form_bytes.length()) {
        if (*id.borrow(i) != *form_bytes.borrow(i)) return false;
        i = i + 1;
    };
    // Suffix — submission nonce
    let mut j = 0;
    while (j < nonce_ref.length()) {
        if (*id.borrow(form_bytes.length() + j) != *nonce_ref.borrow(j)) return false;
        j = j + 1;
    };
    true
}

/// Called by Seal key servers when a client requests the decryption key
/// shares for a ciphertext. Succeeds only if the caller is either the form
/// creator or the original submitter, AND the identity is correctly bound
/// to this (form, submission) pair.
entry fun seal_approve_read_submission(
    id: vector<u8>,
    form: &Form,
    submission: &Submission,
    ctx: &TxContext,
) {
    assert!(check_read_identity(&id, form, submission), E_BAD_IDENTITY);
    let caller = ctx.sender();
    assert!(
        caller == form::owner(form) || caller == submission::submitter(submission),
        E_UNAUTHORIZED,
    );
}

/// Extended variant: in addition to owner + submitter, any address in the
/// form's `FormReviewers.members` set can decrypt. Used after a form has
/// added co-reviewers via `reviewers::add_reviewer`. Falls through to the
/// same identity check as `seal_approve_read_submission`.
entry fun seal_approve_read_submission_with_reviewers(
    id: vector<u8>,
    form: &Form,
    submission: &Submission,
    reviewers_obj: &FormReviewers,
    ctx: &TxContext,
) {
    assert!(check_read_identity(&id, form, submission), E_BAD_IDENTITY);
    reviewers::assert_for_form(reviewers_obj, form::id_address(form));
    let caller = ctx.sender();
    let allowed =
        caller == form::owner(form) ||
        caller == submission::submitter(submission) ||
        reviewers::is_reviewer(reviewers_obj, caller);
    assert!(allowed, E_UNAUTHORIZED);
}

/// Called by Seal before encryption to validate that a new ciphertext for
/// this form is being minted by an address legitimately able to submit.
/// We deliberately keep this permissive (access-mode enforcement really
/// happens in submission::submit) so Seal's encrypt flow doesn't deadlock
/// over edge cases like allowlist mutations between encrypt and submit.
entry fun seal_approve_submit(
    id: vector<u8>,
    form: &Form,
    _ctx: &TxContext,
) {
    // Identity must start with this form's id (the caller hasn't created a
    // Submission yet, so we can't check the nonce half).
    let form_bytes = sui::bcs::to_bytes(&form::id_address(form));
    assert!(id.length() >= form_bytes.length(), E_BAD_IDENTITY);
    let mut i = 0;
    while (i < form_bytes.length()) {
        assert!(*id.borrow(i) == *form_bytes.borrow(i), E_BAD_IDENTITY);
        i = i + 1;
    };
}

/// Schema-level decryption for Private forms (ACCESS_ALLOWLIST). The
/// ciphertext identity is the form's id bytes — callers who are the form
/// owner OR a member of the bound allowlist can decrypt. Public / token /
/// paid access modes are not supported on this path; they decrypt on
/// submit-time via the respondent flow.
entry fun seal_approve_read_form_schema(
    id: vector<u8>,
    form: &Form,
    allowlist: &Allowlist,
    ctx: &TxContext,
) {
    // Identity prefix must be the form's id.
    let form_bytes = sui::bcs::to_bytes(&form::id_address(form));
    assert!(id.length() >= form_bytes.length(), E_BAD_IDENTITY);
    let mut i = 0;
    while (i < form_bytes.length()) {
        assert!(*id.borrow(i) == *form_bytes.borrow(i), E_BAD_IDENTITY);
        i = i + 1;
    };
    // The allowlist must be bound to this form.
    assert!(allowlist::form_id(allowlist) == form::id_address(form), E_WRONG_FORM);

    // Creator + allowlist members can decrypt. Non-private modes are
    // expected to use plaintext schemas — if you land here with a Public
    // form the call still succeeds for the owner, which is fine (owner
    // already has full visibility off-chain anyway).
    let caller = ctx.sender();
    assert!(
        caller == form::owner(form) || allowlist::contains(allowlist, caller),
        E_UNAUTHORIZED,
    );
}

/// Schema-level decryption for Marketplace templates. The ciphertext
/// identity is the template's id bytes. Only the template creator can
/// decrypt the ciphertext pre-sale; buyers receive the decrypted schema
/// client-side via `template::purchase_template` / `clone_free`, which
/// already hand them a fresh plaintext Form.
entry fun seal_approve_read_template_schema(
    id: vector<u8>,
    template_obj: &FormTemplate,
    ctx: &TxContext,
) {
    let template_bytes = sui::bcs::to_bytes(&template::id_address(template_obj));
    assert!(id.length() >= template_bytes.length(), E_BAD_IDENTITY);
    let mut i = 0;
    while (i < template_bytes.length()) {
        assert!(*id.borrow(i) == *template_bytes.borrow(i), E_BAD_IDENTITY);
        i = i + 1;
    };
    let caller = ctx.sender();
    assert!(caller == template::creator(template_obj), E_UNAUTHORIZED);
}

// Expose error codes for tests.
public fun e_bad_identity(): u64 { E_BAD_IDENTITY }
public fun e_unauthorized(): u64 { E_UNAUTHORIZED }
public fun e_wrong_form(): u64 { E_WRONG_FORM }
