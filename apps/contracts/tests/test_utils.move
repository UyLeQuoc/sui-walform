/// Shared helpers for Move unit tests — test-only, never shipped.
#[test_only]
module walform::test_utils;

use std::string;
use sui::clock::{Self, Clock};
use sui::test_scenario::{Self as ts, Scenario};
use walform::form::{Self, Form, FormSettings};
use walform::form_owner_cap::FormOwnerCap;

public fun creator(): address { @0xC0FFEE }
public fun submitter(): address { @0xBEEF }
public fun third_party(): address { @0xBAD }

/// Default public-access settings with no deadline / cap / fee.
public fun public_settings(): FormSettings {
    form::new_settings(
        form::access_public(),
        option::none(),
        vector::empty<u8>(),
        0,
        0,
        0,
        0,
    )
}

public fun allowlist_settings(allowlist_id: address): FormSettings {
    form::new_settings(
        form::access_allowlist(),
        option::some(allowlist_id),
        vector::empty<u8>(),
        0,
        0,
        0,
        0,
    )
}

public fun paid_settings(fee_mist: u64): FormSettings {
    form::new_settings(
        form::access_paid(),
        option::none(),
        vector::empty<u8>(),
        0,
        fee_mist,
        0,
        0,
    )
}

public fun public_settings_with_limits(
    max_submissions: u64,
    closes_at_ms: u64,
): FormSettings {
    form::new_settings(
        form::access_public(),
        option::none(),
        vector::empty<u8>(),
        0,
        0,
        max_submissions,
        closes_at_ms,
    )
}

/// Shorthand: build and immediately share a form with the given settings.
/// Sender of the current tx becomes the owner and receives the FormOwnerCap.
public fun new_public_form(scenario: &mut Scenario, clock: &Clock): (Form, FormOwnerCap) {
    let ctx = ts::ctx(scenario);
    form::create_form(
        string::utf8(b"Test form"),
        example_schema(),
        vector::empty<u8>(),
        public_settings(),
        clock,
        ctx,
    )
}

public fun new_form_with_settings(
    scenario: &mut Scenario,
    clock: &Clock,
    settings: FormSettings,
): (Form, FormOwnerCap) {
    let ctx = ts::ctx(scenario);
    form::create_form(
        string::utf8(b"Test form"),
        example_schema(),
        vector::empty<u8>(),
        settings,
        clock,
        ctx,
    )
}

public fun example_schema(): vector<u8> {
    b"{\"version\":\"1.0\",\"fields\":[]}"
}

public fun example_body(): vector<u8> {
    // Placeholder "ciphertext" — real flows use Seal; tests just need non-empty bytes.
    b"ciphertext"
}

public fun example_nonce(): vector<u8> {
    // 16 bytes (NONCE_BYTES).
    b"0123456789abcdef"
}

public fun make_test_clock(scenario: &mut Scenario): Clock {
    clock::create_for_testing(ts::ctx(scenario))
}
