import { normalizeSuiAddress } from '@mysten/sui/utils';
import type { ClientWithCoreApi } from '@mysten/sui/client';

interface CreatedObject {
  objectId: string;
  objectType: string;
}

/**
 * After a Walrus Sites deploy tx executes, find the freshly-created Site
 * object id. Two strategies because the type prefix isn't always what the env
 * says:
 *   1. Exact match on `${walrusSitePackageId}::site::Site`
 *   2. Loose match on any created type ending in `::site::Site` — Walrus Sites
 *      types keep their declaration package across upgrades, so the id in env
 *      can be a later version than the one on the type
 *
 * Re-tries the whole search 3× with a 1.5s delay because a node can briefly
 * report a settled tx with no object types attached.
 *
 * The third JSON-RPC-era strategy (walk `effects.created` and `getObject` each
 * id for its type) is gone: `objectTypes` already returns exactly that map in
 * the same response, so the extra round-trips bought nothing.
 */
export async function extractWalrusSiteId(
  client: ClientWithCoreApi,
  digest: string,
  walrusSitePackageId: string,
): Promise<string | null> {
  const pkgNormalized = normalizeSuiAddress(walrusSitePackageId);
  let lastChanges: CreatedObject[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await client.core.waitForTransaction({
      digest,
      include: { effects: true, objectTypes: true },
    });
    const tx = res.Transaction ?? res.FailedTransaction;
    const types = tx?.objectTypes ?? {};
    const changes: CreatedObject[] = (tx?.effects?.changedObjects ?? [])
      .filter((c) => c.idOperation === 'Created')
      .map((c) => ({ objectId: c.objectId, objectType: types[c.objectId] ?? '' }));
    lastChanges = changes;

    // Strategy 1: exact pkg + module + struct match.
    let match = changes.find((c) => isCreatedSite(c, pkgNormalized, true));
    if (match) return match.objectId;

    // Strategy 2: loose — any created object whose type ends in `::site::Site`.
    match = changes.find((c) => isCreatedSite(c, pkgNormalized, false));
    if (match) return match.objectId;

    // Node might be lagging — wait + retry.
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
  }

  // Give the caller something to debug with — log the created objects so the
  // user can paste them back if extraction keeps failing.
  console.warn(
    '[extractWalrusSiteId] no site::Site among the tx\'s created objects',
    JSON.stringify({ digest, expectedPkg: pkgNormalized, created: lastChanges }, null, 2),
  );
  return null;
}

function isCreatedSite(change: CreatedObject, pkgNormalized: string, exact: boolean): boolean {
  if (!change.objectType) return false;
  const parts = change.objectType.split('::');
  if (parts.length < 3) return false;
  const typePkg = normalizeSuiAddress(parts[0]!);
  const typeSuffix = parts.slice(1).join('::');
  if (typeSuffix !== 'site::Site') return false;
  if (exact) return typePkg === pkgNormalized;
  return true;
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
  // Clean root URL: the deploy bakes this form's id + network into the bundle's
  // `config.json`, so the shell renders the form at `/` — no `#/f/<id>` needed.
  // (`formId` stays in the signature for callers; the hash route remains a
  // dev-only fallback the shell still honours.)
  const subdomain = hexObjectIdToBase36(siteObjectId);
  if (network === 'mainnet') {
    return `https://${subdomain}.wal.app/`;
  }
  const overrideHost = process.env.NEXT_PUBLIC_WALRUS_PORTAL_HOST_TESTNET;
  // Override is host-only (e.g. `portal.example.com:4000`); we always speak
  // http for non-mainnet to make the localhost case work without TLS setup.
  // Strip any leading scheme the user may have included.
  const host = (overrideHost || 'localhost:4000').replace(/^https?:\/\//, '');
  return `http://${subdomain}.${host}/`;
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
  client: ClientWithCoreApi,
  digest: string,
): Promise<GasUsedSummary | null> {
  try {
    const res = await client.core.getTransaction({ digest, include: { effects: true } });
    const g = (res.Transaction ?? res.FailedTransaction)?.effects?.gasUsed;
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
