'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount, useSuiClientContext } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { Form } from '../../sui/gen/walform/form';
import { FormOwnerCap } from '../../sui/gen/walform/form_owner_cap';
import { FormTemplate } from '../../sui/gen/walform/template';
import { getMoveObjects, listOwnedMoveObjects } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import { useOriginalPackageId } from '../../sui/package-id';

export interface OnChainForm {
  /** FormOwnerCap objectId (owned by connected wallet). */
  capId: string;
  /** The Form shared-object id referenced by the cap. */
  formId: string;
  title: string;
  /** ms — 0 means "never". */
  closesAtMs: number;
  /** 0 means unlimited. */
  maxSubmissions: number;
  submissionCount: number;
  accessMode: number;
  closed: boolean;
  /** Mirrored from the Form's `site_object_id: Option<address>`; null when the
   *  form hasn't been deployed as a Walrus Site (Mode B) yet. */
  siteObjectId: string | null;
  /** Walrus aggregator URL parsed from schema JSON; null when missing or
   *  the schema can't be decoded (e.g. sealed schema). */
  coverImage: string | null;
}

export interface OnChainTemplate {
  templateId: string;
  title: string;
  description: string;
  category: number;
  cloneCount: number;
  creator: string;
  tags: string[];
}

export interface UseOnChainFormsResult {
  running: OnChainForm[];
  ended: OnChainForm[];
  templates: OnChainTemplate[];
  isLoading: boolean;
  error: Error | null;
  /** True when the connected wallet has no walform package on this network. */
  packageMissing: boolean;
}

/**
 * Fetch the connected wallet's on-chain forms + templates directly from Sui.
 * IDB holds only unpublished drafts — published items must come from chain so
 * they survive browser/device changes.
 *
 * Flow:
 *   1. listOwnedObjects type=FormOwnerCap → extract (capId, formId).
 *   2. getObjects(formIds) → read settings/stats/closed fields.
 *   3. listOwnedObjects type=FormTemplate → extract template metadata.
 */
export function useOnChainForms(): UseOnChainFormsResult {
  const account = useCurrentAccount();
  const { network } = useSuiClientContext();
  const originalPackageId = useOriginalPackageId();
  const client = useSuiGrpcClient();

  const owner = account?.address;
  const packageMissing = !originalPackageId;

  // Snapshot "now" once — running/ended boundary; re-render happens on any
  // query data change anyway.
  const [nowMs] = useState(() => Date.now());

  const capsQuery = useQuery({
    queryKey: [network, 'walform:owned-form-caps', owner ?? null, originalPackageId],
    enabled: !!owner && !!originalPackageId,
    queryFn: ({ signal }) =>
      listOwnedMoveObjects(client, FormOwnerCap, {
        owner: owner!,
        type: `${originalPackageId!}::form_owner_cap::FormOwnerCap`,
        signal,
      }),
  });

  const capEntries = useMemo(
    () =>
      (capsQuery.data ?? []).map((cap) => ({
        capId: cap.objectId,
        formId: normalizeSuiAddress(cap.fields.form_id),
      })),
    [capsQuery.data],
  );

  const formIds = useMemo(() => capEntries.map((e) => e.formId), [capEntries]);

  const formsQuery = useQuery({
    queryKey: [network, 'walform:forms-by-id', formIds],
    enabled: formIds.length > 0,
    queryFn: ({ signal }) => getMoveObjects(client, Form, formIds, signal),
  });

  const templatesQuery = useQuery({
    queryKey: [network, 'walform:owned-templates', owner ?? null, originalPackageId],
    enabled: !!owner && !!originalPackageId,
    queryFn: ({ signal }) =>
      listOwnedMoveObjects(client, FormTemplate, {
        owner: owner!,
        type: `${originalPackageId!}::template::FormTemplate`,
        signal,
      }),
  });

  const { running, ended } = useMemo(() => {
    const now = nowMs;
    // Key by formId rather than pairing by array index: a form whose object no
    // longer resolves is dropped from the batch, which would shift every
    // subsequent cap onto the wrong form under index pairing.
    const capByFormId = new Map(capEntries.map((e) => [e.formId, e.capId]));
    const rows: OnChainForm[] = [];
    for (const obj of formsQuery.data ?? []) {
      const formId = normalizeSuiAddress(obj.objectId);
      const capId = capByFormId.get(formId);
      if (!capId) continue;
      const f = obj.fields;
      rows.push({
        capId,
        formId,
        title: f.title || 'Untitled',
        closesAtMs: Number(f.settings.closes_at_ms),
        maxSubmissions: Number(f.settings.max_submissions),
        submissionCount: Number(f.stats.submission_count),
        accessMode: Number(f.settings.access_mode),
        closed: f.closed,
        // BCS gives `Option<address>` as the address or null outright.
        siteObjectId: f.site_object_id ? normalizeSuiAddress(f.site_object_id) : null,
        coverImage: extractCoverImage(f.schema),
      });
    }
    const running: OnChainForm[] = [];
    const ended: OnChainForm[] = [];
    for (const r of rows) {
      const isEnded = r.closed || (r.closesAtMs !== 0 && now >= r.closesAtMs);
      (isEnded ? ended : running).push(r);
    }
    return { running, ended };
  }, [formsQuery.data, capEntries, nowMs]);

  const templates = useMemo<OnChainTemplate[]>(
    () =>
      (templatesQuery.data ?? []).map((obj) => ({
        templateId: obj.objectId,
        title: obj.fields.title || 'Untitled template',
        description: obj.fields.description,
        category: Number(obj.fields.category),
        cloneCount: Number(obj.fields.clone_count),
        creator: normalizeSuiAddress(obj.fields.creator),
        tags: obj.fields.tags,
      })),
    [templatesQuery.data],
  );

  const isLoading =
    (!!owner && capsQuery.isPending) ||
    (capEntries.length > 0 && formsQuery.isPending) ||
    (!!owner && templatesQuery.isPending);
  const error =
    (capsQuery.error as Error | null) ??
    (formsQuery.error as Error | null) ??
    (templatesQuery.error as Error | null) ??
    null;

  return { running, ended, templates, isLoading, error, packageMissing };
}

/**
 * Best-effort decode of the on-chain `schema` bytes into a coverImage URL.
 * Sealed-schema forms (encrypted bytes) and any malformed/missing input
 * return null silently — the caller falls back to the status-tinted banner.
 */
function extractCoverImage(schema: number[] | Uint8Array | undefined): string | null {
  if (!schema || schema.length === 0) return null;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(schema));
    const parsed = JSON.parse(text) as { coverImage?: unknown };
    if (typeof parsed.coverImage === 'string' && parsed.coverImage.length > 0) {
      return parsed.coverImage;
    }
  } catch {
    // Sealed ciphertext or non-JSON payload — leave cover null.
  }
  return null;
}
