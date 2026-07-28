/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { type BcsType, bcs } from '@mysten/sui/bcs';
// Manual patch — re-apply after `bun run contracts:codegen` (same deal as
// gen/utils/index.ts). `MoveStruct`'s inferred type reaches into @mysten/bcs
// for `InferBcsInput` / `InferBcsType`, which TS refuses to name from here
// (TS2883) unless the package is directly importable. Importing the types
// makes them nameable; @mysten/bcs is a direct dependency for this reason.
import type { InferBcsInput, InferBcsType } from '@mysten/bcs';
import { MoveStruct } from '../../../utils/index.js';

export type { InferBcsInput, InferBcsType };
const $moduleName = '0x2::vec_set';
/**
 * A set data structure backed by a vector. The set is guaranteed not to contain
 * duplicate keys. All operations are O(N) in the size of the set
 *
 * - the intention of this data structure is only to provide the convenience of
 *   programming against a set API. Sets that need sorted iteration rather than
 *   insertion order iteration should be handwritten.
 */
export function VecSet<K extends BcsType<any>>(...typeParameters: [
    K
]) {
    return new MoveStruct({ name: `${$moduleName}::VecSet<${typeParameters[0].name as K['name']}>`, fields: {
            contents: bcs.vector(typeParameters[0])
        } });
}