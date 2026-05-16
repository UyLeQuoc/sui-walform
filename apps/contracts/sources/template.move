/// Template marketplace — FormTemplate + Kiosk integration + global
/// TransferPolicy<FormTemplate> with a 10% royalty rule installed at
/// package init. See PRD §7.2 / §8.2.
module walform::template;

use std::string::String;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
use sui::package;
use sui::sui::SUI;
use sui::transfer_policy::{Self, TransferPolicy, TransferPolicyCap};

use walform::events;
use walform::form::{Self, Form, FormSettings};
use walform::form_owner_cap::{Self, FormOwnerCap};

// === Constants ===

/// 10% in basis points (1000 bps = 10%; 1 bps = 0.01%).
const PLATFORM_ROYALTY_BPS: u16 = 1000;
/// 0.05 SUI floor so tiny sales still yield something meaningful.
const PLATFORM_MIN_ROYALTY_MIST: u64 = 50_000_000;

// === Errors ===

const E_WRONG_CAP: u64 = 1;
const E_INSUFFICIENT_ROYALTY: u64 = 2;
const E_ROYALTY_RULE_MISSING: u64 = 3;
const E_BAD_PRICE: u64 = 4;

// === One-time witness + module init ===

public struct TEMPLATE has drop {}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(TEMPLATE {}, ctx)
}

#[test_only]
public fun share_listing_for_testing(l: TemplateListing) {
    transfer::share_object(l)
}

fun init(otw: TEMPLATE, ctx: &mut TxContext) {
    // 1. Claim the Publisher for this package — proof we published these types.
    let publisher = package::claim(otw, ctx);

    // 2. Create the single global TransferPolicy<FormTemplate>.
    let (mut policy, policy_cap) = transfer_policy::new<FormTemplate>(&publisher, ctx);

    // 3. Install our custom royalty rule.
    add_royalty_rule_internal(&mut policy, &policy_cap, PLATFORM_ROYALTY_BPS, PLATFORM_MIN_ROYALTY_MIST);

    // 4. Share policy; transfer cap + publisher to the deployer.
    transfer::public_share_object(policy);
    transfer::public_transfer(policy_cap, ctx.sender());

    // 5. Bootstrap the treasury.
    let treasury = PlatformTreasury {
        id: object::new(ctx),
        balance: balance::zero(),
    };
    transfer::share_object(treasury);

    // 6. Admin cap + publisher to deployer.
    let admin = PlatformAdminCap { id: object::new(ctx) };
    transfer::public_transfer(admin, ctx.sender());
    transfer::public_transfer(publisher, ctx.sender());
}

// === Royalty rule (custom — avoids depending on an external royalty_rule module) ===

public struct RoyaltyRule has drop {}

public struct RoyaltyConfig has store, drop, copy {
    bps: u16,
    min_amount_mist: u64,
}

fun add_royalty_rule_internal(
    policy: &mut TransferPolicy<FormTemplate>,
    cap: &TransferPolicyCap<FormTemplate>,
    bps: u16,
    min_amount_mist: u64,
) {
    transfer_policy::add_rule<FormTemplate, RoyaltyRule, RoyaltyConfig>(
        RoyaltyRule {},
        policy,
        cap,
        RoyaltyConfig { bps, min_amount_mist },
    );
}

fun royalty_due(config: &RoyaltyConfig, paid: u64): u64 {
    let pct = ((paid as u128) * (config.bps as u128) / 10_000u128) as u64;
    if (pct < config.min_amount_mist) config.min_amount_mist else pct
}

// === Structs ===

public struct FormTemplate has key, store {
    id: UID,
    creator: address,
    title: String,
    description: String,
    category: u8,
    /// Inline schema JSON — same 100 KB cap as Form.schema. Copied into a
    /// fresh Form when cloned.
    schema: vector<u8>,
    theme: vector<u8>,
    preview_blob_id: Option<vector<u8>>,
    tags: vector<String>,
    created_at_ms: u64,
    clone_count: u64,
}

public struct PlatformTreasury has key {
    id: UID,
    balance: Balance<SUI>,
}

public struct PlatformAdminCap has key, store { id: UID }

// === Publishing a template ===

public fun publish_template(
    cap: &FormOwnerCap,
    form: &Form,
    title: String,
    description: String,
    category: u8,
    preview_blob_id: Option<vector<u8>>,
    tags: vector<String>,
    clock: &Clock,
    ctx: &mut TxContext,
): FormTemplate {
    // Only the form's owner can publish it as a template.
    form_owner_cap::assert_for(cap, form::id_address(form));

    let schema_copy = *form::schema(form);
    let theme_copy = *form::theme(form);
    let now = clock.timestamp_ms();

    let uid = object::new(ctx);
    let template_id = object::uid_to_address(&uid);
    let creator = ctx.sender();

    let template = FormTemplate {
        id: uid,
        creator,
        title,
        description,
        category,
        schema: schema_copy,
        theme: theme_copy,
        preview_blob_id,
        tags,
        created_at_ms: now,
        clone_count: 0,
    };

    events::emit_template_published(events::new_template_published(
        template_id, creator, template.title, category, now,
    ));

    template
}

/// DEPRECATED — kept only for Sui upgrade compatibility. The active paid
/// marketplace path is `create_listing_and_share` + `clone_paid_and_share`
/// (TemplateListing). Do not call from new code; the TS client no longer
/// has a publish-via-Kiosk path. See PRD Appendix A 2026-05-12.
public fun place_and_list(
    kiosk: &mut Kiosk,
    kiosk_cap: &KioskOwnerCap,
    template: FormTemplate,
    price_mist: u64,
) {
    assert!(price_mist > 0, E_BAD_PRICE);
    let template_id = object::id(&template);
    kiosk::place(kiosk, kiosk_cap, template);
    kiosk::list<FormTemplate>(kiosk, kiosk_cap, template_id, price_mist);
}

// === Pay-to-clone listing (multi-buyer, no Kiosk) ===
//
// Kiosk's `purchase` consumes the listed item (1-of-1 NFT sales), which is
// wrong for template marketplace semantics where one template should be
// cloneable N times with each buyer paying price + royalty. The Listing path
// below keeps the FormTemplate alive as a shared object and routes payment
// to the creator + royalty to the platform treasury on every clone.

public struct TemplateListing has key {
    id: UID,
    template_id: address,
    creator: address,
    price_mist: u64,
}

const E_NOT_CREATOR: u64 = 5;
const E_WRONG_LISTING: u64 = 6;
const E_INSUFFICIENT_PAYMENT: u64 = 7;

/// Creator lists a shared FormTemplate at `price_mist`. Anyone can then call
/// `clone_paid` on it. The listing is a separate shared object so price can
/// be updated without re-minting the template.
public fun create_listing(
    template: &FormTemplate,
    price_mist: u64,
    ctx: &mut TxContext,
): TemplateListing {
    assert!(ctx.sender() == template.creator, E_NOT_CREATOR);
    assert!(price_mist > 0, E_BAD_PRICE);
    TemplateListing {
        id: object::new(ctx),
        template_id: object::uid_to_address(&template.id),
        creator: template.creator,
        price_mist,
    }
}

/// Convenience: create + share the listing in one tx.
public fun create_listing_and_share(
    template: &FormTemplate,
    price_mist: u64,
    ctx: &mut TxContext,
) {
    let listing = create_listing(template, price_mist, ctx);
    transfer::share_object(listing);
}

/// Buyer calls this to clone a paid template: pays price to creator, pays
/// 10% (or floor) royalty to the platform treasury, gets a fresh Form.
/// The template object is NOT consumed — next buyer can do the same.
public fun clone_paid(
    template: &mut FormTemplate,
    listing: &TemplateListing,
    treasury: &mut PlatformTreasury,
    policy: &TransferPolicy<FormTemplate>,
    payment: Coin<SUI>,
    royalty_payment: Coin<SUI>,
    owner_settings: FormSettings,
    title_for_new: String,
    clock: &Clock,
    ctx: &mut TxContext,
): (Form, FormOwnerCap) {
    // Listing must be bound to this template.
    assert!(
        listing.template_id == object::uid_to_address(&template.id),
        E_WRONG_LISTING,
    );
    let price = listing.price_mist;
    assert!(coin::value(&payment) >= price, E_INSUFFICIENT_PAYMENT);

    // Royalty: same RoyaltyConfig semantics as the Kiosk path so the
    // platform take is consistent across both flows.
    let config: &RoyaltyConfig = transfer_policy::get_rule<FormTemplate, RoyaltyRule, RoyaltyConfig>(
        RoyaltyRule {},
        policy,
    );
    let required_royalty = royalty_due(config, price);
    assert!(coin::value(&royalty_payment) >= required_royalty, E_INSUFFICIENT_ROYALTY);

    // Price goes to the creator; royalty to the platform treasury.
    transfer::public_transfer(payment, listing.creator);
    balance::join(&mut treasury.balance, coin::into_balance(royalty_payment));

    let now = clock.timestamp_ms();
    let (form, cap) = form::mint_from_template(
        ctx.sender(),
        title_for_new,
        template.schema,
        template.theme,
        owner_settings,
        now,
        ctx,
    );
    template.clone_count = template.clone_count + 1;

    events::emit_template_cloned(events::new_template_cloned(
        object::uid_to_address(&template.id),
        ctx.sender(),
        price,
        required_royalty,
        form::id_address(&form),
    ));

    (form, cap)
}

public fun clone_paid_and_share(
    template: &mut FormTemplate,
    listing: &TemplateListing,
    treasury: &mut PlatformTreasury,
    policy: &TransferPolicy<FormTemplate>,
    payment: Coin<SUI>,
    royalty_payment: Coin<SUI>,
    owner_settings: FormSettings,
    title_for_new: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let (form, cap) = clone_paid(
        template, listing, treasury, policy,
        payment, royalty_payment,
        owner_settings, title_for_new, clock, ctx,
    );
    form::share(form);
    transfer::public_transfer(cap, ctx.sender());
}

// === Purchase-only (no Form mint) — preview-then-publish flow ===
//
// Pays the creator + 10% royalty + bumps clone_count + emits TemplateCloned
// with `new_form_id = @0x0` (sentinel for "no on-chain Form yet — buyer is
// drafting"). The buyer's client then materialises an IndexedDB draft from
// the template's schema/theme and routes them into the editor; they call
// `form::create_form` themselves when ready to go live.
public fun purchase_template_only(
    template: &mut FormTemplate,
    listing: &TemplateListing,
    treasury: &mut PlatformTreasury,
    policy: &TransferPolicy<FormTemplate>,
    payment: Coin<SUI>,
    royalty_payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(
        listing.template_id == object::uid_to_address(&template.id),
        E_WRONG_LISTING,
    );
    let price = listing.price_mist;
    assert!(coin::value(&payment) >= price, E_INSUFFICIENT_PAYMENT);

    let config: &RoyaltyConfig = transfer_policy::get_rule<FormTemplate, RoyaltyRule, RoyaltyConfig>(
        RoyaltyRule {},
        policy,
    );
    let required_royalty = royalty_due(config, price);
    assert!(coin::value(&royalty_payment) >= required_royalty, E_INSUFFICIENT_ROYALTY);

    transfer::public_transfer(payment, listing.creator);
    balance::join(&mut treasury.balance, coin::into_balance(royalty_payment));

    template.clone_count = template.clone_count + 1;

    let _ = clock;
    events::emit_template_cloned(events::new_template_cloned(
        object::uid_to_address(&template.id),
        ctx.sender(),
        price,
        required_royalty,
        @0x0,
    ));
}

/// Zero-payment counterpart for free templates. Lets the client bump
/// `clone_count` after the user actually publishes a form drafted from this
/// template, so the marketplace metric stays universal across free + paid.
public fun record_free_clone(
    template: &mut FormTemplate,
    clock: &Clock,
    ctx: &TxContext,
) {
    template.clone_count = template.clone_count + 1;
    let _ = clock;
    events::emit_template_cloned(events::new_template_cloned(
        object::uid_to_address(&template.id),
        ctx.sender(),
        0,
        0,
        @0x0,
    ));
}

public fun update_listing_price(
    listing: &mut TemplateListing,
    new_price_mist: u64,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == listing.creator, E_NOT_CREATOR);
    assert!(new_price_mist > 0, E_BAD_PRICE);
    listing.price_mist = new_price_mist;
}

public fun listing_template_id(l: &TemplateListing): address { l.template_id }
public fun listing_creator(l: &TemplateListing): address { l.creator }
public fun listing_price_mist(l: &TemplateListing): u64 { l.price_mist }

// === Free clone path (price = 0, no Kiosk) ===

public fun clone_free(
    template: &mut FormTemplate,
    owner_settings: FormSettings,
    title_for_new: String,
    clock: &Clock,
    ctx: &mut TxContext,
): (Form, FormOwnerCap) {
    let now = clock.timestamp_ms();
    let (form, cap) = form::mint_from_template(
        ctx.sender(),
        title_for_new,
        template.schema,
        template.theme,
        owner_settings,
        now,
        ctx,
    );
    template.clone_count = template.clone_count + 1;
    events::emit_template_cloned(events::new_template_cloned(
        object::uid_to_address(&template.id),
        ctx.sender(),
        0, // price paid
        0, // royalty paid
        form::id_address(&form),
    ));
    (form, cap)
}

public fun clone_free_and_share(
    template: &mut FormTemplate,
    owner_settings: FormSettings,
    title_for_new: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let (form, cap) = clone_free(template, owner_settings, title_for_new, clock, ctx);
    form::share(form);
    transfer::public_transfer(cap, ctx.sender());
}

// === Paid clone path (Kiosk purchase + royalty) — DEPRECATED ===
//
// Kept only for Sui upgrade compatibility (public function signatures cannot
// be removed under `compatible` upgrades). The active paid path is
// `clone_paid_and_share` above — see PRD Appendix A 2026-05-12. No TS client
// code calls `purchase_template*` anymore.

/// DEPRECATED — see section header. Use `clone_paid_and_share` instead.
public fun purchase_template(
    seller_kiosk: &mut Kiosk,
    template_id: address,
    policy: &mut TransferPolicy<FormTemplate>,
    treasury: &mut PlatformTreasury,
    payment: Coin<SUI>,
    royalty_payment: Coin<SUI>,
    owner_settings: FormSettings,
    title_for_new: String,
    clock: &Clock,
    ctx: &mut TxContext,
): (Form, FormOwnerCap) {
    let listed_price = coin::value(&payment);
    let (template, mut request) = kiosk::purchase<FormTemplate>(
        seller_kiosk,
        object::id_from_address(template_id),
        payment,
    );

    // Pay the platform royalty: look up our rule config, validate payment, route to treasury.
    let config: &RoyaltyConfig = transfer_policy::get_rule<FormTemplate, RoyaltyRule, RoyaltyConfig>(
        RoyaltyRule {},
        policy,
    );
    let required = royalty_due(config, listed_price);
    assert!(coin::value(&royalty_payment) >= required, E_INSUFFICIENT_ROYALTY);
    balance::join(&mut treasury.balance, coin::into_balance(royalty_payment));
    transfer_policy::add_receipt<FormTemplate, RoyaltyRule>(RoyaltyRule {}, &mut request);

    // Finalise transfer.
    transfer_policy::confirm_request<FormTemplate>(policy, request);

    // We now own `template` — unpack and mint a Form.
    let FormTemplate {
        id: mut template_uid,
        creator: _,
        title: _,
        description: _,
        category: _,
        schema,
        theme,
        preview_blob_id: _,
        tags: _,
        created_at_ms: _,
        clone_count,
    } = template;

    let template_addr = object::uid_to_address(&template_uid);
    object::delete(template_uid);

    let now = clock.timestamp_ms();
    let (form, cap) = form::mint_from_template(
        ctx.sender(),
        title_for_new,
        schema,
        theme,
        owner_settings,
        now,
        ctx,
    );

    events::emit_template_cloned(events::new_template_cloned(
        template_addr,
        ctx.sender(),
        listed_price,
        required,
        form::id_address(&form),
    ));

    // suppress unused warning
    let _ = clone_count;

    (form, cap)
}

/// DEPRECATED — see section header. Use `clone_paid_and_share` instead.
public fun purchase_template_and_share(
    seller_kiosk: &mut Kiosk,
    template_id: address,
    policy: &mut TransferPolicy<FormTemplate>,
    treasury: &mut PlatformTreasury,
    payment: Coin<SUI>,
    royalty_payment: Coin<SUI>,
    owner_settings: FormSettings,
    title_for_new: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let (form, cap) = purchase_template(
        seller_kiosk, template_id, policy, treasury,
        payment, royalty_payment,
        owner_settings, title_for_new, clock, ctx,
    );
    form::share(form);
    transfer::public_transfer(cap, ctx.sender());
}

// === Platform admin ===

public fun withdraw_platform(
    _cap: &PlatformAdminCap,
    treasury: &mut PlatformTreasury,
    amount_mist: u64,
    ctx: &mut TxContext,
): Coin<SUI> {
    let taken = balance::split(&mut treasury.balance, amount_mist);
    let coin = coin::from_balance(taken, ctx);
    events::emit_platform_withdrawn(events::new_platform_withdrawn(ctx.sender(), amount_mist));
    coin
}

// === View helpers ===

public fun id_address(t: &FormTemplate): address { object::uid_to_address(&t.id) }
public fun creator(t: &FormTemplate): address { t.creator }
public fun title(t: &FormTemplate): &String { &t.title }
public fun description(t: &FormTemplate): &String { &t.description }
public fun category(t: &FormTemplate): u8 { t.category }
public fun schema(t: &FormTemplate): &vector<u8> { &t.schema }
public fun theme(t: &FormTemplate): &vector<u8> { &t.theme }
public fun tags(t: &FormTemplate): &vector<String> { &t.tags }
public fun clone_count(t: &FormTemplate): u64 { t.clone_count }

public fun platform_balance(t: &PlatformTreasury): u64 { balance::value(&t.balance) }

public fun platform_royalty_bps(): u16 { PLATFORM_ROYALTY_BPS }
public fun platform_min_royalty_mist(): u64 { PLATFORM_MIN_ROYALTY_MIST }
