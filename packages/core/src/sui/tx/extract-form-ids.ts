import { normalizeSuiAddress } from '@mysten/sui/utils';
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

export interface ExtractedPublishIds {
  formObjectId: string | null;
  formOwnerCapId: string | null;
  allowlistId: string | null;
  templateId: string | null;
  kioskId: string | null;
  kioskOwnerCapId: string | null;
}

interface ObjectChangeLike {
  type?: string;
  objectId?: string;
  objectType?: string;
}

/**
 * After a publish/kiosk PTB executes, wait for the tx to settle then fetch its
 * objectChanges and pull out the handful of ids the app needs to store.
 *
 * IMPORTANT: on Sui, an object's `objectType` always uses the package address
 * where the type was first declared (i.e. `originalPackageId`), even after
 * upgrades that bump the current packageId. Pass `originalPackageId` here —
 * not the current packageId — or this returns nulls when upgrades exist.
 *
 * Kiosk types live under `0x2` and are not affected by walform upgrades.
 */
export async function extractPublishIds(
  client: SuiJsonRpcClient,
  digest: string,
  originalPackageId: string,
): Promise<ExtractedPublishIds> {
  await client.waitForTransaction({ digest });
  const block = await client.getTransactionBlock({
    digest,
    options: { showEffects: true, showObjectChanges: true },
  });

  const pkgNormalized = normalizeSuiAddress(originalPackageId);
  const changes = (block.objectChanges ?? []) as ObjectChangeLike[];
  const find = (suffix: string): string | null => {
    const hit = changes.find((c) => {
      if (c.type !== 'created' || !c.objectType) return false;
      // objectType is "pkg::module::Type[<generics>]"; match by normalized prefix.
      const typeParts = c.objectType.split('::');
      if (typeParts.length < 3) return false;
      const typePkg = normalizeSuiAddress(typeParts[0]!);
      const typeSuffix = typeParts.slice(1).join('::');
      return typePkg === pkgNormalized && typeSuffix === suffix;
    });
    return hit?.objectId ?? null;
  };
  const findExact = (type: string): string | null => {
    const normalized = normalizeObjectType(type);
    const hit = changes.find(
      (c) => c.type === 'created' && normalizeObjectType(c.objectType ?? '') === normalized,
    );
    return hit?.objectId ?? null;
  };

  return {
    formObjectId: find('form::Form'),
    formOwnerCapId: find('form_owner_cap::FormOwnerCap'),
    allowlistId: find('allowlist::Allowlist'),
    templateId: find('template::FormTemplate'),
    kioskId: findExact('0x2::kiosk::Kiosk'),
    kioskOwnerCapId: findExact('0x2::kiosk::KioskOwnerCap'),
  };
}

function normalizeObjectType(type: string): string {
  const parts = type.split('::');
  if (parts.length < 3) return type;
  const [pkg, ...rest] = parts as [string, ...string[]];
  return `${normalizeSuiAddress(pkg)}::${rest.join('::')}`;
}
