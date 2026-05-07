/// Form — the root object for one deployed form. Schema is stored inline
/// (not Walrus) per PRD §7.4; capped at MAX_SCHEMA_BYTES to bound object
/// size. Settings hold access_mode + publish-time limits.
module walform::form;

use std::string::String;
use sui::clock::{Self, Clock};
use walform::events;
use walform::form_owner_cap::{Self, FormOwnerCap};

// === Constants ===

const MAX_SCHEMA_BYTES: u64 = 100_000; // 100 KB — ~500+ questions
const MAX_TITLE_BYTES: u64 = 512;
const MAX_THEME_BYTES: u64 = 8_192;

// Access modes (PRD §4.4)
const ACCESS_PUBLIC: u8 = 0;
const ACCESS_ALLOWLIST: u8 = 1;
const ACCESS_TOKEN: u8 = 2;
const ACCESS_PAID: u8 = 3;

// === Errors ===

const E_SCHEMA_TOO_LARGE: u64 = 1;
const E_TITLE_TOO_LONG: u64 = 2;
const E_THEME_TOO_LARGE: u64 = 3;
const E_BAD_ACCESS_MODE: u64 = 4;
const E_FORM_CLOSED: u64 = 5;

// === Structs ===

public struct Form has key {
    id: UID,
    owner: address,
    title: String,
    /// FormSchema JSON bytes — stored INLINE (see PRD §7.4).
    schema: vector<u8>,
    /// Only set if the creator opted into Mode B Walrus-Site deploy.
    site_object_id: Option<address>,
    /// Optional Walrus blob id for cover image (no cover → None).
    cover_blob_id: Option<vector<u8>>,
    /// Small JSON blob with theme tokens (colors, font family).
    theme: vector<u8>,
    settings: FormSettings,
    stats: FormStats,
    /// Flipped true by close_form(); submit() rejects closed forms.
    closed: bool,
}

public struct FormSettings has store, copy, drop {
    access_mode: u8,
    /// Only set when access_mode == ACCESS_ALLOWLIST.
    allowlist_id: Option<address>,
    /// For ACCESS_TOKEN: the Move type we gate on (Coin<T>). Stored as
    /// bytes to avoid dragging TypeName generics through the struct.
    required_token_type: vector<u8>,
    required_token_amount: u64,
    /// For ACCESS_PAID: fee per submit in MIST.
    submission_fee_mist: u64,
    /// 0 = unlimited.
    max_submissions: u64,
    /// 0 = never.
    closes_at_ms: u64,
}

public struct FormStats has store, copy, drop {
    submission_count: u64,
    total_revenue_mist: u64,
    last_submission_at_ms: u64,
}

// === Lifecycle ===

public fun create_form(
    title: String,
    schema: vector<u8>,
    theme: vector<u8>,
    settings: FormSettings,
    clock: &Clock,
    ctx: &mut TxContext,
): (Form, FormOwnerCap) {
    assert!(schema.length() <= MAX_SCHEMA_BYTES, E_SCHEMA_TOO_LARGE);
    assert!(title.as_bytes().length() <= MAX_TITLE_BYTES, E_TITLE_TOO_LONG);
    assert!(theme.length() <= MAX_THEME_BYTES, E_THEME_TOO_LARGE);
    assert_valid_access_mode(settings.access_mode);

    let now = clock.timestamp_ms();
    let owner = ctx.sender();
    let uid = object::new(ctx);
    let form_id = object::uid_to_address(&uid);

    let form = Form {
        id: uid,
        owner,
        title,
        schema,
        site_object_id: option::none(),
        cover_blob_id: option::none(),
        theme,
        settings,
        stats: FormStats { submission_count: 0, total_revenue_mist: 0, last_submission_at_ms: 0 },
        closed: false,
    };

    events::emit_form_created(events::new_form_created(form_id, owner, form.title, form.schema.length(), now));

    let cap = form_owner_cap::new(form_id, ctx);
    (form, cap)
}

/// Convenience: create + share the Form in one call. Most publish flows use this.
/// Called from PTB as `form::create_and_share(title, schema, theme, form::new_settings(...), clock)`.
public fun create_and_share(
    title: String,
    schema: vector<u8>,
    theme: vector<u8>,
    settings: FormSettings,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let (form, cap) = create_form(title, schema, theme, settings, clock, ctx);
    share(form);
    transfer::public_transfer(cap, ctx.sender());
}

/// Share a Form as a shared object. Package-public so template.move can call
/// this during clone flows; callers outside this package should go through
/// `create_and_share` or `mint_from_template` paths.
public fun share(form: Form) { transfer::share_object(form) }

public fun update_schema(
    form: &mut Form,
    cap: &FormOwnerCap,
    new_schema: vector<u8>,
) {
    form_owner_cap::assert_for(cap, form.id.to_address());
    assert!(new_schema.length() <= MAX_SCHEMA_BYTES, E_SCHEMA_TOO_LARGE);
    assert!(!form.closed, E_FORM_CLOSED);
    form.schema = new_schema;
}

public fun update_settings(
    form: &mut Form,
    cap: &FormOwnerCap,
    new_settings: FormSettings,
) {
    form_owner_cap::assert_for(cap, form.id.to_address());
    assert!(!form.closed, E_FORM_CLOSED);
    assert_valid_access_mode(new_settings.access_mode);
    form.settings = new_settings;
    events::emit_form_settings_updated(events::new_form_settings_updated(
        form.id.to_address(),
        new_settings.access_mode,
        new_settings.max_submissions,
        new_settings.closes_at_ms,
    ));
}

public fun set_site_object_id(
    form: &mut Form,
    cap: &FormOwnerCap,
    site: address,
) {
    form_owner_cap::assert_for(cap, form.id.to_address());
    form.site_object_id = option::some(site);
}

/// Same as `set_site_object_id` but takes the Site object by-reference and
/// extracts its id internally — lets a single PTB create the Site object and
/// mirror it onto the Form atomically (impossible with the address variant
/// because PTBs can't read a fresh object's address as a `pure.address` arg).
/// Generic `T: key` avoids hard-pinning to walrus_sites' Site type.
public fun set_site_object_id_obj<T: key>(
    form: &mut Form,
    cap: &FormOwnerCap,
    site: &T,
) {
    form_owner_cap::assert_for(cap, form.id.to_address());
    form.site_object_id = option::some(object::id(site).to_address());
}

public fun set_cover_blob_id(
    form: &mut Form,
    cap: &FormOwnerCap,
    blob_id: vector<u8>,
) {
    form_owner_cap::assert_for(cap, form.id.to_address());
    form.cover_blob_id = option::some(blob_id);
}

public fun close_form(form: &mut Form, cap: &FormOwnerCap, clock: &Clock) {
    form_owner_cap::assert_for(cap, form.id.to_address());
    form.closed = true;
    events::emit_form_closed(events::new_form_closed(form.id.to_address(), clock.timestamp_ms()));
}

// === Settings constructor (callable from PTBs) ===

public fun new_settings(
    access_mode: u8,
    allowlist_id: Option<address>,
    required_token_type: vector<u8>,
    required_token_amount: u64,
    submission_fee_mist: u64,
    max_submissions: u64,
    closes_at_ms: u64,
): FormSettings {
    assert_valid_access_mode(access_mode);
    FormSettings {
        access_mode,
        allowlist_id,
        required_token_type,
        required_token_amount,
        submission_fee_mist,
        max_submissions,
        closes_at_ms,
    }
}

fun assert_valid_access_mode(m: u8) {
    assert!(m == ACCESS_PUBLIC || m == ACCESS_ALLOWLIST || m == ACCESS_TOKEN || m == ACCESS_PAID, E_BAD_ACCESS_MODE);
}

// === View helpers (consumed by other modules and TS) ===

/// Address form of the form's UID — the canonical "form id" used for event
/// payloads, Seal identity prefix, and cross-module references.
public fun id_address(form: &Form): address { object::uid_to_address(&form.id) }

public fun owner(form: &Form): address { form.owner }
public fun title(form: &Form): &String { &form.title }
public fun schema(form: &Form): &vector<u8> { &form.schema }
public fun theme(form: &Form): &vector<u8> { &form.theme }
public fun site_object_id(form: &Form): &Option<address> { &form.site_object_id }
public fun cover_blob_id(form: &Form): &Option<vector<u8>> { &form.cover_blob_id }
public fun settings(form: &Form): &FormSettings { &form.settings }
public fun stats(form: &Form): &FormStats { &form.stats }
public fun closed(form: &Form): bool { form.closed }

public fun access_mode(s: &FormSettings): u8 { s.access_mode }
public fun allowlist_id(s: &FormSettings): &Option<address> { &s.allowlist_id }
public fun submission_fee_mist(s: &FormSettings): u64 { s.submission_fee_mist }
public fun max_submissions(s: &FormSettings): u64 { s.max_submissions }
public fun closes_at_ms(s: &FormSettings): u64 { s.closes_at_ms }
public fun required_token_type(s: &FormSettings): &vector<u8> { &s.required_token_type }
public fun required_token_amount(s: &FormSettings): u64 { s.required_token_amount }

public fun submission_count(s: &FormStats): u64 { s.submission_count }
public fun total_revenue_mist(s: &FormStats): u64 { s.total_revenue_mist }

// Public access-mode constants so TS / other modules don't hardcode.
public fun access_public(): u8 { ACCESS_PUBLIC }
public fun access_allowlist(): u8 { ACCESS_ALLOWLIST }
public fun access_token(): u8 { ACCESS_TOKEN }
public fun access_paid(): u8 { ACCESS_PAID }
public fun max_schema_bytes(): u64 { MAX_SCHEMA_BYTES }

// === Package-internal mutators (used by submission.move + template.move) ===

public(package) fun bump_stats(form: &mut Form, fee_mist: u64, now_ms: u64) {
    form.stats.submission_count = form.stats.submission_count + 1;
    form.stats.total_revenue_mist = form.stats.total_revenue_mist + fee_mist;
    form.stats.last_submission_at_ms = now_ms;
}

/// Used by template::clone_free / purchase_template when minting a Form from
/// a template. Identical to create_form but exposed as a package-internal fn.
public(package) fun mint_from_template(
    owner: address,
    title: String,
    schema: vector<u8>,
    theme: vector<u8>,
    settings: FormSettings,
    now_ms: u64,
    ctx: &mut TxContext,
): (Form, FormOwnerCap) {
    assert!(schema.length() <= MAX_SCHEMA_BYTES, E_SCHEMA_TOO_LARGE);
    assert_valid_access_mode(settings.access_mode);
    let uid = object::new(ctx);
    let form_id = object::uid_to_address(&uid);
    let form = Form {
        id: uid,
        owner,
        title,
        schema,
        site_object_id: option::none(),
        cover_blob_id: option::none(),
        theme,
        settings,
        stats: FormStats { submission_count: 0, total_revenue_mist: 0, last_submission_at_ms: 0 },
        closed: false,
    };
    events::emit_form_created(events::new_form_created(form_id, owner, form.title, form.schema.length(), now_ms));
    let cap = form_owner_cap::new(form_id, ctx);
    (form, cap)
}
