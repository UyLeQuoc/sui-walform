/// Allowlist — membership set bound to one Form. Used by ACCESS_ALLOWLIST
/// forms (and reused as the gating object for ACCESS_TOKEN holder checks,
/// though submission.move does the actual balance check).
module walform::allowlist;

use sui::clock::Clock;
use sui::vec_set::{Self, VecSet};
use walform::events;
use walform::form_owner_cap::{Self, FormOwnerCap};

const E_ALREADY_MEMBER: u64 = 1;
const E_NOT_MEMBER: u64 = 2;
const E_WRONG_FORM: u64 = 3;

public struct Allowlist has key {
    id: UID,
    form_id: address,
    members: VecSet<address>,
}

public fun create(
    cap: &FormOwnerCap,
    clock: &Clock,
    ctx: &mut TxContext,
): Allowlist {
    let uid = object::new(ctx);
    let allowlist_id = uid.to_address();
    let form_id = form_owner_cap::form_id(cap);
    events::emit_allowlist_created(events::new_allowlist_created(
        allowlist_id, form_id, ctx.sender(), clock.timestamp_ms(),
    ));
    Allowlist { id: uid, form_id, members: vec_set::empty() }
}

public fun create_and_share(cap: &FormOwnerCap, clock: &Clock, ctx: &mut TxContext) {
    let al = create(cap, clock, ctx);
    share(al);
}

/// Share an Allowlist as a shared object. Module-visible so tests and
/// template flows can share from outside the declaring module.
public fun share(al: Allowlist) { transfer::share_object(al) }

public fun add(al: &mut Allowlist, cap: &FormOwnerCap, member: address) {
    assert_cap(al, cap);
    assert!(!al.members.contains(&member), E_ALREADY_MEMBER);
    al.members.insert(member);
    events::emit_allowlist_updated(events::new_allowlist_updated(
        al.id.to_address(), al.form_id, member, true,
    ));
}

public fun add_many(al: &mut Allowlist, cap: &FormOwnerCap, members: vector<address>) {
    assert_cap(al, cap);
    let mut i = 0;
    while (i < members.length()) {
        let m = *members.borrow(i);
        if (!al.members.contains(&m)) {
            al.members.insert(m);
            events::emit_allowlist_updated(events::new_allowlist_updated(
                al.id.to_address(), al.form_id, m, true,
            ));
        };
        i = i + 1;
    };
}

public fun remove(al: &mut Allowlist, cap: &FormOwnerCap, member: address) {
    assert_cap(al, cap);
    assert!(al.members.contains(&member), E_NOT_MEMBER);
    al.members.remove(&member);
    events::emit_allowlist_updated(events::new_allowlist_updated(
        al.id.to_address(), al.form_id, member, false,
    ));
}

public fun contains(al: &Allowlist, who: address): bool {
    al.members.contains(&who)
}

public fun form_id(al: &Allowlist): address { al.form_id }
public fun size(al: &Allowlist): u64 { al.members.length() }

fun assert_cap(al: &Allowlist, cap: &FormOwnerCap) {
    assert!(form_owner_cap::form_id(cap) == al.form_id, E_WRONG_FORM);
}
