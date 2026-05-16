/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Capability that proves ownership of a Form. Issued at `form::create_form` and
 * transferable — transfer the cap and you transfer ownership. Required to mutate
 * settings, publish templates, withdraw payments, close the form, etc.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
const $moduleName = 'walform::form_owner_cap';
export const FormOwnerCap = new MoveStruct({ name: `${$moduleName}::FormOwnerCap`, fields: {
        id: bcs.Address,
        form_id: bcs.Address
    } });
export interface FormIdArguments {
    cap: RawTransactionArgument<string>;
}
export interface FormIdOptions {
    package?: string;
    arguments: FormIdArguments | [
        cap: RawTransactionArgument<string>
    ];
}
export function formId(options: FormIdOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form_owner_cap',
        function: 'form_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IdArguments {
    cap: RawTransactionArgument<string>;
}
export interface IdOptions {
    package?: string;
    arguments: IdArguments | [
        cap: RawTransactionArgument<string>
    ];
}
export function id(options: IdOptions) {
    const packageAddress = options.package ?? 'walform';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'form_owner_cap',
        function: 'id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}