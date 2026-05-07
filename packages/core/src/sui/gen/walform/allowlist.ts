/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/

/**
 * Allowlist — membership set bound to one Form. Used by ACCESS_ALLOWLIST forms
 * (and reused as the gating object for ACCESS_TOKEN holder checks, though
 * submission.move does the actual balance check).
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as vec_set from './deps/sui/vec_set';
const $moduleName = 'walform::allowlist';
export const Allowlist = new MoveStruct({
  name: `${$moduleName}::Allowlist`,
  fields: {
    id: bcs.Address,
    form_id: bcs.Address,
    members: vec_set.VecSet(bcs.Address),
  },
});
export interface CreateArguments {
  cap: RawTransactionArgument<string>;
}
export interface CreateOptions {
  package?: string;
  arguments: CreateArguments | [cap: RawTransactionArgument<string>];
}
export function create(options: CreateOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null, '0x2::clock::Clock'] satisfies (string | null)[];
  const parameterNames = ['cap'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'allowlist',
      function: 'create',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreateAndShareArguments {
  cap: RawTransactionArgument<string>;
}
export interface CreateAndShareOptions {
  package?: string;
  arguments: CreateAndShareArguments | [cap: RawTransactionArgument<string>];
}
export function createAndShare(options: CreateAndShareOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null, '0x2::clock::Clock'] satisfies (string | null)[];
  const parameterNames = ['cap'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'allowlist',
      function: 'create_and_share',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ShareArguments {
  al: RawTransactionArgument<string>;
}
export interface ShareOptions {
  package?: string;
  arguments: ShareArguments | [al: RawTransactionArgument<string>];
}
/**
 * Share an Allowlist as a shared object. Module-visible so tests and template
 * flows can share from outside the declaring module.
 */
export function share(options: ShareOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null] satisfies (string | null)[];
  const parameterNames = ['al'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'allowlist',
      function: 'share',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddArguments {
  al: RawTransactionArgument<string>;
  cap: RawTransactionArgument<string>;
  member: RawTransactionArgument<string>;
}
export interface AddOptions {
  package?: string;
  arguments:
    | AddArguments
    | [
        al: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        member: RawTransactionArgument<string>,
      ];
}
export function add(options: AddOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null, null, 'address'] satisfies (string | null)[];
  const parameterNames = ['al', 'cap', 'member'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'allowlist',
      function: 'add',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddManyArguments {
  al: RawTransactionArgument<string>;
  cap: RawTransactionArgument<string>;
  members: RawTransactionArgument<Array<string>>;
}
export interface AddManyOptions {
  package?: string;
  arguments:
    | AddManyArguments
    | [
        al: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        members: RawTransactionArgument<Array<string>>,
      ];
}
export function addMany(options: AddManyOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null, null, 'vector<address>'] satisfies (string | null)[];
  const parameterNames = ['al', 'cap', 'members'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'allowlist',
      function: 'add_many',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveArguments {
  al: RawTransactionArgument<string>;
  cap: RawTransactionArgument<string>;
  member: RawTransactionArgument<string>;
}
export interface RemoveOptions {
  package?: string;
  arguments:
    | RemoveArguments
    | [
        al: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        member: RawTransactionArgument<string>,
      ];
}
export function remove(options: RemoveOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null, null, 'address'] satisfies (string | null)[];
  const parameterNames = ['al', 'cap', 'member'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'allowlist',
      function: 'remove',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ContainsArguments {
  al: RawTransactionArgument<string>;
  who: RawTransactionArgument<string>;
}
export interface ContainsOptions {
  package?: string;
  arguments:
    | ContainsArguments
    | [al: RawTransactionArgument<string>, who: RawTransactionArgument<string>];
}
export function contains(options: ContainsOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null, 'address'] satisfies (string | null)[];
  const parameterNames = ['al', 'who'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'allowlist',
      function: 'contains',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FormIdArguments {
  al: RawTransactionArgument<string>;
}
export interface FormIdOptions {
  package?: string;
  arguments: FormIdArguments | [al: RawTransactionArgument<string>];
}
export function formId(options: FormIdOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null] satisfies (string | null)[];
  const parameterNames = ['al'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'allowlist',
      function: 'form_id',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SizeArguments {
  al: RawTransactionArgument<string>;
}
export interface SizeOptions {
  package?: string;
  arguments: SizeArguments | [al: RawTransactionArgument<string>];
}
export function size(options: SizeOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null] satisfies (string | null)[];
  const parameterNames = ['al'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'allowlist',
      function: 'size',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
