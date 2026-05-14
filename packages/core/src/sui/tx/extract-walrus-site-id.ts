import { normalizeSuiAddress } from '@mysten/sui/utils';
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

interface ObjectChangeLike {
  type?: string;
  objectId?: string;
  objectType?: string;
}

/**
 * After a Walrus Sites deploy tx executes, find the freshly-created Site
 * object id. Multiple strategies because indexers occasionally lag:
 *   1. Exact match on `${walrusSitePackageId}::site::Site` in objectChanges
 *   2. Loose match on any objectType ending in `::site::Site` (handles cases
 *      where the type prefix is the upstream package vs the env-configured
 *      one — Walrus Sites types preserve their declaration package across
 *      upgrades)
 *   3. Fallback to effects.created with type lookup via getObject
 *
 * Re-tries the whole search 3× with 1.5s delay between because the RPC
 * indexer sometimes returns empty objectChanges right after a tx settles.
 */
export async function extractWalrusSiteId(
  client: SuiJsonRpcClient,
  digest: string,
  walrusSitePackageId: string,
): Promise<string | null> {
  await client.waitForTransaction({ digest });
  const pkgNormalized = normalizeSuiAddress(walrusSitePackageId);

  let lastBlock: Awaited<ReturnType<typeof client.getTransactionBlock>> | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const block = await client.getTransactionBlock({
      digest,
      options: { showEffects: true, showObjectChanges: true },
    });
    lastBlock = block;
    const changes = (block.objectChanges ?? []) as ObjectChangeLike[];

    // Strategy 1: exact pkg + module + struct match.
    let match = changes.find((c) => isCreatedSite(c, pkgNormalized, true));
    if (match?.objectId) return match.objectId;

    // Strategy 2: loose — any `created` whose type ends in `::site::Site`.
    // Walrus Sites types might come back under the original-publish package
    // address when querying through certain indexer paths.
    match = changes.find((c) => isCreatedSite(c, pkgNormalized, false));
    if (match?.objectId) return match.objectId;

    // Strategy 3: fallback to effects.created + per-id type lookup.
    const fallback = await fallbackByEffects(client, block, pkgNormalized);
    if (fallback) return fallback;

    // Indexer might be lagging — wait + retry.
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
  }

  // Give the caller something to debug with — log the raw objectChanges so
  // the user can paste it back if extraction keeps failing.
  console.warn(
    '[extractWalrusSiteId] no site::Site found in objectChanges',
    JSON.stringify(
      {
        digest,
        expectedPkg: pkgNormalized,
        objectChanges: lastBlock?.objectChanges,
        effectsCreated: lastBlock?.effects?.created,
      },
      null,
      2,
    ),
  );
  return null;
}

function isCreatedSite(change: ObjectChangeLike, pkgNormalized: string, exact: boolean): boolean {
  if (change.type !== 'created' || !change.objectType) return false;
  const parts = change.objectType.split('::');
  if (parts.length < 3) return false;
  const typePkg = normalizeSuiAddress(parts[0]!);
  const typeSuffix = parts.slice(1).join('::');
  if (typeSuffix !== 'site::Site') return false;
  if (exact) return typePkg === pkgNormalized;
  return true;
}

async function fallbackByEffects(
  client: SuiJsonRpcClient,
  block: unknown,
  pkgNormalized: string,
): Promise<string | null> {
  const effects = (block as { effects?: { created?: unknown[] } | null }).effects;
  const created = (effects?.created ?? []) as Array<{
    reference?: { objectId?: string };
  }>;
  for (const c of created) {
    const id = c.reference?.objectId;
    if (!id) continue;
    try {
      const obj = await client.getObject({ id, options: { showType: true } });
      const type = obj.data?.type;
      if (!type) continue;
      const parts = type.split('::');
      if (parts.length < 3) continue;
      const typePkg = normalizeSuiAddress(parts[0]!);
      const typeSuffix = parts.slice(1).join('::');
      if (typeSuffix === 'site::Site' && typePkg === pkgNormalized) {
        return id;
      }
    } catch {
      // skip — keep checking other ids
    }
  }
  return null;
}

const BASE36_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Convert a Sui object id (`0x...` hex, 32 bytes) to the base36 subdomain
 * encoding used by the Walrus Sites portal: `https://<base36>.wal.app`.
 *
 * The encoding mirrors `b36.encode(fromHex(id.slice(2)))` from
 * `apps/portal/lib/src/objectId_operations.ts` — same alphabet, same
 * leading-zero-byte → leading-'0'-char preservation. Implemented inline so
 * `@walform/core` doesn't pull in a `base-x` dep just for this one helper.
 */
export function hexObjectIdToBase36(objectId: string): string {
  const hex = objectId.startsWith('0x') ? objectId.slice(2) : objectId;
  if (hex.length === 0) return '';
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  // Count leading zero bytes — each one becomes a leading '0' in the
  // output, matching baseX's behaviour.
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++;

  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);

  let suffix = '';
  while (n > 0n) {
    suffix = BASE36_ALPHABET[Number(n % 36n)] + suffix;
    n /= 36n;
  }
  return '0'.repeat(leadingZeros) + suffix;
}

/**
 * Pick the public URL for a deployed Walrus Site, network-aware:
 *
 *   - mainnet → `https://<base36>.wal.app/...`
 *     Mysten operates `wal.app` only for mainnet sites.
 *   - testnet / devnet → `http://<base36>.localhost:4000/...`
 *     There's no Mysten-hosted testnet portal — viewers run our own copy
 *     locally (see `apps/portal`, `bun run --cwd apps/portal dev`).
 *
 * Override the non-mainnet host via `NEXT_PUBLIC_WALRUS_PORTAL_HOST_TESTNET`
 * if the portal lives somewhere other than `localhost:4000`.
 */
export function walrusSitePublicUrl(
  siteObjectId: string,
  formId: string,
  network: 'testnet' | 'mainnet' | 'devnet',
): string {
  const subdomain = hexObjectIdToBase36(siteObjectId);
  if (network === 'mainnet') {
    return `https://${subdomain}.wal.app/#/f/${formId}`;
  }
  const overrideHost =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WALRUS_PORTAL_HOST_TESTNET;
  // Override is host-only (e.g. `portal.example.com:4000`); we always speak
  // http for non-mainnet to make the localhost case work without TLS setup.
  // Strip any leading scheme the user may have included.
  const host = (overrideHost || 'localhost:4000').replace(/^https?:\/\//, '');
  return `http://${subdomain}.${host}/#/f/${formId}`;
}

export function isWalrusPortalLocal(network: 'testnet' | 'mainnet' | 'devnet'): boolean {
  return network !== 'mainnet';
}

/**
 * Pull the gas cost out of a tx response. Returns total MIST = computation +
 * storageCost − storageRebate. Used to show the user how much the deploy
 * actually cost (sponsored by admin, but the number is honest).
 */
export interface GasUsedSummary {
  computationMist: bigint;
  storageMist: bigint;
  rebateMist: bigint;
  netMist: bigint;
}

export async function getTxGasCost(
  client: SuiJsonRpcClient,
  digest: string,
): Promise<GasUsedSummary | null> {
  try {
    const block = await client.getTransactionBlock({
      digest,
      options: { showEffects: true },
    });
    const g = block.effects?.gasUsed;
    if (!g) return null;
    const computation = BigInt(g.computationCost ?? '0');
    const storage = BigInt(g.storageCost ?? '0');
    const rebate = BigInt(g.storageRebate ?? '0');
    return {
      computationMist: computation,
      storageMist: storage,
      rebateMist: rebate,
      netMist: computation + storage - rebate,
    };
  } catch {
    return null;
  }
}
