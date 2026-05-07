/// Capability that proves ownership of a Form.
/// Issued at `form::create_form` and transferable — transfer the cap and you
/// transfer ownership. Required to mutate settings, publish templates,
/// withdraw payments, close the form, etc.
module walform::form_owner_cap;

public struct FormOwnerCap has key, store {
    id: UID,
    form_id: address,
}

public(package) fun new(form_id: address, ctx: &mut TxContext): FormOwnerCap {
    FormOwnerCap { id: object::new(ctx), form_id }
}

public fun form_id(cap: &FormOwnerCap): address { cap.form_id }

public fun id(cap: &FormOwnerCap): &UID { &cap.id }

// Assertion helper used by every caller-gated entry fn across modules.
public(package) fun assert_for(cap: &FormOwnerCap, expected_form_id: address) {
    assert!(cap.form_id == expected_form_id, 0);
}
