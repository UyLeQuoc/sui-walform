/// Centralised event definitions. Every domain module emits through these
/// types so indexers only need to subscribe to a single module's event stream.
/// See PRD §8.
module walform::events;

public struct FormCreated has copy, drop {
    form_id: address,
    owner: address,
    title: std::string::String,
    schema_len: u64,
    created_at_ms: u64,
}

public struct FormSettingsUpdated has copy, drop {
    form_id: address,
    access_mode: u8,
    max_submissions: u64,
    closes_at_ms: u64,
}

public struct FormClosed has copy, drop {
    form_id: address,
    closed_at_ms: u64,
}

public struct SubmissionCreated has copy, drop {
    form_id: address,
    submission_id: address,
    submitter: address,
    body_len: u64,
    submitted_at_ms: u64,
}

public struct AllowlistUpdated has copy, drop {
    allowlist_id: address,
    form_id: address,
    member: address,
    added: bool, // true = added, false = removed
}

public struct AllowlistCreated has copy, drop {
    allowlist_id: address,
    form_id: address,
    creator: address,
    created_at_ms: u64,
}

public struct PaymentDeposited has copy, drop {
    form_id: address,
    submitter: address,
    amount_mist: u64,
}

public struct PaymentWithdrawn has copy, drop {
    form_id: address,
    to: address,
    amount_mist: u64,
}

public struct TemplatePublished has copy, drop {
    template_id: address,
    creator: address,
    title: std::string::String,
    category: u8,
    created_at_ms: u64,
}

public struct TemplateCloned has copy, drop {
    template_id: address,
    buyer: address,
    price_paid_mist: u64,
    royalty_paid_mist: u64,
    new_form_id: address,
}

public struct PlatformWithdrawn has copy, drop {
    to: address,
    amount_mist: u64,
}

// Emit helpers — so other modules don't duplicate event::emit boilerplate.

public(package) fun emit_form_created(e: FormCreated) { sui::event::emit(e) }
public(package) fun emit_form_settings_updated(e: FormSettingsUpdated) { sui::event::emit(e) }
public(package) fun emit_form_closed(e: FormClosed) { sui::event::emit(e) }
public(package) fun emit_submission_created(e: SubmissionCreated) { sui::event::emit(e) }
public(package) fun emit_allowlist_updated(e: AllowlistUpdated) { sui::event::emit(e) }
public(package) fun emit_allowlist_created(e: AllowlistCreated) { sui::event::emit(e) }
public(package) fun emit_payment_deposited(e: PaymentDeposited) { sui::event::emit(e) }
public(package) fun emit_payment_withdrawn(e: PaymentWithdrawn) { sui::event::emit(e) }
public(package) fun emit_template_published(e: TemplatePublished) { sui::event::emit(e) }
public(package) fun emit_template_cloned(e: TemplateCloned) { sui::event::emit(e) }
public(package) fun emit_platform_withdrawn(e: PlatformWithdrawn) { sui::event::emit(e) }

// Constructor helpers so other modules can build events without `has store`
// shenanigans — these structs are copy+drop only.

public(package) fun new_form_created(form_id: address, owner: address, title: std::string::String, schema_len: u64, created_at_ms: u64): FormCreated {
    FormCreated { form_id, owner, title, schema_len, created_at_ms }
}

public(package) fun new_form_settings_updated(form_id: address, access_mode: u8, max_submissions: u64, closes_at_ms: u64): FormSettingsUpdated {
    FormSettingsUpdated { form_id, access_mode, max_submissions, closes_at_ms }
}

public(package) fun new_form_closed(form_id: address, closed_at_ms: u64): FormClosed {
    FormClosed { form_id, closed_at_ms }
}

public(package) fun new_submission_created(form_id: address, submission_id: address, submitter: address, body_len: u64, submitted_at_ms: u64): SubmissionCreated {
    SubmissionCreated { form_id, submission_id, submitter, body_len, submitted_at_ms }
}

public(package) fun new_allowlist_updated(allowlist_id: address, form_id: address, member: address, added: bool): AllowlistUpdated {
    AllowlistUpdated { allowlist_id, form_id, member, added }
}

public(package) fun new_allowlist_created(allowlist_id: address, form_id: address, creator: address, created_at_ms: u64): AllowlistCreated {
    AllowlistCreated { allowlist_id, form_id, creator, created_at_ms }
}

public(package) fun new_payment_deposited(form_id: address, submitter: address, amount_mist: u64): PaymentDeposited {
    PaymentDeposited { form_id, submitter, amount_mist }
}

public(package) fun new_payment_withdrawn(form_id: address, to: address, amount_mist: u64): PaymentWithdrawn {
    PaymentWithdrawn { form_id, to, amount_mist }
}

public(package) fun new_template_published(template_id: address, creator: address, title: std::string::String, category: u8, created_at_ms: u64): TemplatePublished {
    TemplatePublished { template_id, creator, title, category, created_at_ms }
}

public(package) fun new_template_cloned(template_id: address, buyer: address, price_paid_mist: u64, royalty_paid_mist: u64, new_form_id: address): TemplateCloned {
    TemplateCloned { template_id, buyer, price_paid_mist, royalty_paid_mist, new_form_id }
}

public(package) fun new_platform_withdrawn(to: address, amount_mist: u64): PlatformWithdrawn {
    PlatformWithdrawn { to, amount_mist }
}
