/**
 * Object reads over gRPC, parsed with the checked-in Move codegen.
 *
 * The codegen structs in `../gen/walform/*` already expose `.get()`/`.getMany()`
 * helpers that hit `client.core.getObjects` and BCS-parse the result. They throw
 * when ANY id in the batch comes back an `Error` (deleted, wrapped, wrong type),
 * which is wrong for this app: every call site here reads a list assembled from
 * event scans, where a since-deleted object must be skipped, not blow up the
 * whole page. These wrappers keep the parsing and drop the failures.
 *
 * BCS, not the `json` include, is deliberate. gRPC's `json` renders `vector<u8>`
 * as base64 and Move `String` as a plain string — indistinguishable without the
 * type layout, so a schema blob and a title would both arrive as strings. BCS +
 * the generated layout gives `Uint8Array` vs `string` exactly, and `u64` as a
 * bigint-safe decimal string.
 */

import type { ClientWithCoreApi, SuiClientTypes } from '@mysten/sui/client';

/**
 * Ids per `getObjects` call. The gRPC `BatchGetObjects` service caps a request
 * server-side; 50 matches the cap the old JSON-RPC `multiGetObjects` enforced
 * and keeps each response small enough to stay well inside the gRPC-web message
 * limit.
 */
const BATCH_SIZE = 50;

export interface ParsedMoveObject<T> {
  objectId: string;
  version: string;
  digest: string;
  type: string;
  owner: SuiClientTypes.ObjectOwner;
  /** BCS-decoded Move struct fields. */
  fields: T;
}

/**
 * The only thing these helpers need from a codegen struct. Structural rather
 * than `MoveStruct<…>` so `T` infers straight from the generated struct's own
 * `parse` return type — naming the class instead makes TS resolve `parse`
 * against its `Record<string, BcsType<any>>` base and erase the field types.
 */
interface MoveStructParser<T> {
  parse: (bytes: Uint8Array) => T;
}

function toParsed<T>(
  obj: SuiClientTypes.Object<{ content: true }>,
  struct: MoveStructParser<T>,
): ParsedMoveObject<T> | null {
  try {
    return {
      objectId: obj.objectId,
      version: obj.version,
      digest: obj.digest,
      type: obj.type,
      owner: obj.owner,
      fields: struct.parse(obj.content),
    };
  } catch {
    // Wrong type for this struct, or a layout the current codegen predates.
    // Skipping keeps one stale object from emptying a whole list.
    return null;
  }
}

/** Fetch + parse many objects, silently dropping ids that no longer resolve. */
export async function getMoveObjects<T>(
  client: ClientWithCoreApi,
  struct: MoveStructParser<T>,
  objectIds: string[],
  signal?: AbortSignal,
): Promise<ParsedMoveObject<T>[]> {
  const out: ParsedMoveObject<T>[] = [];
  for (let i = 0; i < objectIds.length; i += BATCH_SIZE) {
    const chunk = objectIds.slice(i, i + BATCH_SIZE);
    const res = await client.core.getObjects({
      objectIds: chunk,
      include: { content: true },
      signal,
    });
    for (const obj of res.objects) {
      if (obj instanceof Error) continue;
      const parsed = toParsed(obj, struct);
      if (parsed) out.push(parsed);
    }
  }
  return out;
}

/** Fetch + parse a single object. Returns null when it doesn't resolve. */
export async function getMoveObject<T>(
  client: ClientWithCoreApi,
  struct: MoveStructParser<T>,
  objectId: string,
  signal?: AbortSignal,
): Promise<ParsedMoveObject<T> | null> {
  const [only] = await getMoveObjects(client, struct, [objectId], signal);
  return only ?? null;
}

/**
 * Every object of `type` owned by `owner`, paginated to exhaustion.
 *
 * Pagination is not optional here: the gRPC page size is a server default, and
 * the JSON-RPC code this replaces had a latent truncation bug of exactly this
 * shape (a single `limit: 200` call silently capped at 50).
 */
export async function listOwnedMoveObjects<T>(
  client: ClientWithCoreApi,
  struct: MoveStructParser<T>,
  options: { owner: string; type: string; signal?: AbortSignal },
): Promise<ParsedMoveObject<T>[]> {
  const out: ParsedMoveObject<T>[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: SuiClientTypes.ListOwnedObjectsResponse<{ content: true }> =
      await client.core.listOwnedObjects({
        owner: options.owner,
        type: options.type,
        cursor,
        include: { content: true },
        signal: options.signal,
      });
    for (const obj of page.objects) {
      const parsed = toParsed(obj, struct);
      if (parsed) out.push(parsed);
    }
    if (!page.hasNextPage || !page.cursor) break;
    cursor = page.cursor;
  }
  return out;
}

export interface JsonObject {
  objectId: string;
  type: string;
  owner: SuiClientTypes.ObjectOwner;
  /** gRPC's JSON rendering of the Move struct. */
  json: Record<string, unknown>;
}

/**
 * Read objects of a FOREIGN Move type — one with no generated struct here
 * (Walrus Sites' `site::Site`, SuiNS registrations, Kiosk internals).
 *
 * Uses the `json` include because BCS decoding needs a layout we don't have.
 * Mind the ambiguities that come with it: `vector<u8>` arrives base64-encoded
 * and indistinguishable from a Move `String`, and `u64` is a decimal string.
 * Prefer `getMoveObjects` with a generated struct whenever one exists.
 */
export async function getJsonObjects(
  client: ClientWithCoreApi,
  objectIds: string[],
  signal?: AbortSignal,
): Promise<JsonObject[]> {
  const out: JsonObject[] = [];
  for (let i = 0; i < objectIds.length; i += BATCH_SIZE) {
    const res = await client.core.getObjects({
      objectIds: objectIds.slice(i, i + BATCH_SIZE),
      include: { json: true },
      signal,
    });
    for (const obj of res.objects) {
      if (obj instanceof Error) continue;
      if (!obj.json) continue;
      out.push({ objectId: obj.objectId, type: obj.type, owner: obj.owner, json: obj.json });
    }
  }
  return out;
}

/** Single-object variant of `getJsonObjects`. Null when it doesn't resolve. */
export async function getJsonObject(
  client: ClientWithCoreApi,
  objectId: string,
  signal?: AbortSignal,
): Promise<JsonObject | null> {
  const [only] = await getJsonObjects(client, [objectId], signal);
  return only ?? null;
}

/**
 * Object ids of `type` owned by `owner`, paginated to exhaustion. For when only
 * the ids matter (capability lookups) and fetching contents would be waste.
 */
export async function listOwnedObjectIds(
  client: ClientWithCoreApi,
  options: { owner: string; type: string; signal?: AbortSignal },
): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: SuiClientTypes.ListOwnedObjectsResponse = await client.core.listOwnedObjects({
      owner: options.owner,
      type: options.type,
      cursor,
      signal: options.signal,
    });
    for (const obj of page.objects) out.push(obj.objectId);
    if (!page.hasNextPage || !page.cursor) break;
    cursor = page.cursor;
  }
  return out;
}

/**
 * Owner address of an object, whatever the ownership kind. `AddressOwner` for
 * wallet-held objects, `ObjectOwner` for anything parented to another object
 * (the marketplace's Kiosk lookup relies on this — a listed item's parent is a
 * `dynamic_field::Field` wrapper, not the Kiosk itself).
 */
export function ownerAddress(owner: SuiClientTypes.ObjectOwner): string | null {
  if (owner.$kind === 'AddressOwner') return owner.AddressOwner;
  if (owner.$kind === 'ObjectOwner') return owner.ObjectOwner;
  if (owner.$kind === 'ConsensusAddressOwner') return owner.ConsensusAddressOwner.owner;
  return null;
}
