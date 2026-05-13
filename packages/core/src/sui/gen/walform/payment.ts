/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/

/**
 * FormTreasury — per-form treasury holding the SUI paid by respondents for
 * ACCESS_PAID forms. Owner-gated withdraw.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as balance from './deps/sui/balance';
const $moduleName = 'walform::payment';
export const FormTreasury = new MoveStruct({
  name: `${$moduleName}::FormTreasury`,
  fields: {
    id: bcs.Address,
    form_id: bcs.Address,
    balance: balance.Balance,
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
  const argumentsTypes = [null] satisfies (string | null)[];
  const parameterNames = ['cap'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'payment',
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
  const argumentsTypes = [null] satisfies (string | null)[];
  const parameterNames = ['cap'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'payment',
      function: 'create_and_share',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ShareArguments {
  t: RawTransactionArgument<string>;
}
export interface ShareOptions {
  package?: string;
  arguments: ShareArguments | [t: RawTransactionArgument<string>];
}
/**
 * Share a FormTreasury as a shared object. Module-visible so tests and external
 * flows can share from outside the declaring module.
 */
export function share(options: ShareOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null] satisfies (string | null)[];
  const parameterNames = ['t'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'payment',
      function: 'share',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface WithdrawArguments {
  treasury: RawTransactionArgument<string>;
  cap: RawTransactionArgument<string>;
  amountMist: RawTransactionArgument<number | bigint>;
}
export interface WithdrawOptions {
  package?: string;
  arguments:
    | WithdrawArguments
    | [
        treasury: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        amountMist: RawTransactionArgument<number | bigint>,
      ];
}
export function withdraw(options: WithdrawOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null, null, 'u64'] satisfies (string | null)[];
  const parameterNames = ['treasury', 'cap', 'amountMist'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'payment',
      function: 'withdraw',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface WithdrawAllArguments {
  treasury: RawTransactionArgument<string>;
  cap: RawTransactionArgument<string>;
}
export interface WithdrawAllOptions {
  package?: string;
  arguments:
    | WithdrawAllArguments
    | [treasury: RawTransactionArgument<string>, cap: RawTransactionArgument<string>];
}
export function withdrawAll(options: WithdrawAllOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null, null] satisfies (string | null)[];
  const parameterNames = ['treasury', 'cap'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'payment',
      function: 'withdraw_all',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FormIdArguments {
  t: RawTransactionArgument<string>;
}
export interface FormIdOptions {
  package?: string;
  arguments: FormIdArguments | [t: RawTransactionArgument<string>];
}
export function formId(options: FormIdOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null] satisfies (string | null)[];
  const parameterNames = ['t'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'payment',
      function: 'form_id',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BalanceValueArguments {
  t: RawTransactionArgument<string>;
}
export interface BalanceValueOptions {
  package?: string;
  arguments: BalanceValueArguments | [t: RawTransactionArgument<string>];
}
export function balanceValue(options: BalanceValueOptions) {
  const packageAddress = options.package ?? 'walform';
  const argumentsTypes = [null] satisfies (string | null)[];
  const parameterNames = ['t'];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: 'payment',
      function: 'balance_value',
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
