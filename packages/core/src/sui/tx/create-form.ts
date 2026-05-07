import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';

export interface BuildCreateFormTxInput {
  packageId: string;
  sender: string;
  title: string;
  schemaBytes: Uint8Array;
  themeBytes: Uint8Array;
  settings: {
    accessMode: 0 | 1 | 2 | 3;
    requiredTokenType?: Uint8Array;
    requiredTokenAmount?: bigint;
    submissionFeeMist?: bigint;
    maxSubmissions?: bigint;
    closesAtMs?: bigint;
  };
  /**
   * For Private (ACCESS_ALLOWLIST) forms, members the creator wants on the
   * Allowlist at publish time. The creator's own address is appended
   * automatically so the `AllowlistCreated` event fires + the indexer can
   * reliably find the allowlist later. Empty/omitted = creator-only.
   */
  allowlistMembers?: string[];
}

/**
 * Atomic publish PTB:
 *   1. new_settings(...)
 *   2. (form, cap) = form::create_form(...)        — by-value, retains cap
 *   3. allowlist = allowlist::create(&cap)         — emits AllowlistCreated
 *   4. allowlist::add_many(&mut allowlist, &cap, [creator, ...members])
 *      (skipped when no members given AND access is public — but for v1 we
 *      always add creator so the AllowlistUpdated event also indexes)
 *   5. allowlist::share(allowlist)
 *   6. form::share(form)
 *   7. transfer(cap, sender)
 *
 * The Form's settings.allowlist_id stays None at publish (we don't know the
 * allowlist's address pre-execute). Discovery is via the AllowlistCreated
 * event filtered by form_id — see useFormAllowlist.
 */
export function buildCreateFormTx(input: BuildCreateFormTxInput): Transaction {
  const tx = new Transaction();
  const pkg = input.packageId;

  // 1. settings (always allowlist_id=None at publish)
  const settingsArg = tx.moveCall({
    target: `${pkg}::form::new_settings`,
    arguments: [
      tx.pure.u8(input.settings.accessMode),
      tx.pure.option('address', null),
      tx.pure.vector('u8', Array.from(input.settings.requiredTokenType ?? new Uint8Array())),
      tx.pure.u64(input.settings.requiredTokenAmount ?? 0n),
      tx.pure.u64(input.settings.submissionFeeMist ?? 0n),
      tx.pure.u64(input.settings.maxSubmissions ?? 0n),
      tx.pure.u64(input.settings.closesAtMs ?? 0n),
    ],
  });

  // 2. create_form returns (Form, FormOwnerCap) by value
  const created = tx.moveCall({
    target: `${pkg}::form::create_form`,
    arguments: [
      tx.pure.string(input.title),
      tx.pure.vector('u8', Array.from(input.schemaBytes)),
      tx.pure.vector('u8', Array.from(input.themeBytes)),
      settingsArg,
      tx.object.clock(),
    ],
  }) as unknown as [TransactionObjectArgument, TransactionObjectArgument];
  const formArg = created[0];
  const capArg = created[1];

  // 3. create allowlist + emit AllowlistCreated
  const allowlistArg = tx.moveCall({
    target: `${pkg}::allowlist::create`,
    arguments: [capArg, tx.object.clock()],
  }) as unknown as TransactionObjectArgument;

  // 4. seed members (always include creator so private gating works
  //    immediately and the AllowlistUpdated event index has at least one
  //    entry per form).
  const members = Array.from(
    new Set([input.sender, ...(input.allowlistMembers ?? []).map((a) => a.trim()).filter(Boolean)]),
  );
  if (members.length > 0) {
    tx.moveCall({
      target: `${pkg}::allowlist::add_many`,
      arguments: [allowlistArg, capArg, tx.pure.vector('address', members)],
    });
  }

  // 5. share allowlist as a shared object
  tx.moveCall({
    target: `${pkg}::allowlist::share`,
    arguments: [allowlistArg],
  });

  // 6. share form
  tx.moveCall({
    target: `${pkg}::form::share`,
    arguments: [formArg],
  });

  // 7. transfer cap to sender
  tx.transferObjects([capArg], input.sender);

  return tx;
}
