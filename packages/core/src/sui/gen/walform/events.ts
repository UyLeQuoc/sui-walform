/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Centralised event definitions. Every domain module emits through these types so
 * indexers only need to subscribe to a single module's event stream. See PRD §8.
 */

import { MoveStruct } from '../utils/index';
import { bcs } from '@mysten/sui/bcs';
const $moduleName = 'walform::events';
export const FormCreated = new MoveStruct({ name: `${$moduleName}::FormCreated`, fields: {
        form_id: bcs.Address,
        owner: bcs.Address,
        title: bcs.string(),
        schema_len: bcs.u64(),
        created_at_ms: bcs.u64()
    } });
export const FormSettingsUpdated = new MoveStruct({ name: `${$moduleName}::FormSettingsUpdated`, fields: {
        form_id: bcs.Address,
        access_mode: bcs.u8(),
        max_submissions: bcs.u64(),
        closes_at_ms: bcs.u64()
    } });
export const FormClosed = new MoveStruct({ name: `${$moduleName}::FormClosed`, fields: {
        form_id: bcs.Address,
        closed_at_ms: bcs.u64()
    } });
export const SubmissionCreated = new MoveStruct({ name: `${$moduleName}::SubmissionCreated`, fields: {
        form_id: bcs.Address,
        submission_id: bcs.Address,
        submitter: bcs.Address,
        body_len: bcs.u64(),
        submitted_at_ms: bcs.u64()
    } });
export const AllowlistUpdated = new MoveStruct({ name: `${$moduleName}::AllowlistUpdated`, fields: {
        allowlist_id: bcs.Address,
        form_id: bcs.Address,
        member: bcs.Address,
        added: bcs.bool()
    } });
export const AllowlistCreated = new MoveStruct({ name: `${$moduleName}::AllowlistCreated`, fields: {
        allowlist_id: bcs.Address,
        form_id: bcs.Address,
        creator: bcs.Address,
        created_at_ms: bcs.u64()
    } });
export const PaymentDeposited = new MoveStruct({ name: `${$moduleName}::PaymentDeposited`, fields: {
        form_id: bcs.Address,
        submitter: bcs.Address,
        amount_mist: bcs.u64()
    } });
export const PaymentWithdrawn = new MoveStruct({ name: `${$moduleName}::PaymentWithdrawn`, fields: {
        form_id: bcs.Address,
        to: bcs.Address,
        amount_mist: bcs.u64()
    } });
export const TemplatePublished = new MoveStruct({ name: `${$moduleName}::TemplatePublished`, fields: {
        template_id: bcs.Address,
        creator: bcs.Address,
        title: bcs.string(),
        category: bcs.u8(),
        created_at_ms: bcs.u64()
    } });
export const TemplateCloned = new MoveStruct({ name: `${$moduleName}::TemplateCloned`, fields: {
        template_id: bcs.Address,
        buyer: bcs.Address,
        price_paid_mist: bcs.u64(),
        royalty_paid_mist: bcs.u64(),
        new_form_id: bcs.Address
    } });
export const PlatformWithdrawn = new MoveStruct({ name: `${$moduleName}::PlatformWithdrawn`, fields: {
        to: bcs.Address,
        amount_mist: bcs.u64()
    } });