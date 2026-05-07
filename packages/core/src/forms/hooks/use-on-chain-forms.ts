'use client';

import { useMemo, useState } from 'react';
import { useCurrentAccount, useSuiClientContext, useSuiClientQuery } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
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
 *   1. getOwnedObjects filter StructType=FormOwnerCap → extract (capId, formId).
 *   2. multiGetObjects(formIds) → read settings/stats/closed fields.
 *   3. getOwnedObjects filter StructType=FormTemplate → extract template metadata.
 */
export function useOnChainForms(): UseOnChainFormsResult {
  const account = useCurrentAccount();
  const { network } = useSuiClientContext();
  const originalPackageId = useOriginalPackageId();

  const owner = account?.address;
  const packageMissing = !originalPackageId;

  // Snapshot "now" once — running/ended boundary; re-render happens on any
  // query data change anyway.
  const [nowMs] = useState(() => Date.now());

  const capsQuery = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: owner ?? '',
      filter: originalPackageId
        ? { StructType: `${originalPackageId}::form_owner_cap::FormOwnerCap` }
        : undefined,
      options: { showType: true, showContent: true },
    },
    { enabled: !!owner && !!originalPackageId },
  );

  const capEntries = useMemo(() => {
    const pages = capsQuery.data?.data ?? [];
    const out: Array<{ capId: string; formId: string }> = [];
    for (const entry of pages) {
      const obj = entry.data;
      if (!obj?.objectId) continue;
      const content = obj.content as unknown as
        | { dataType: 'moveObject'; fields: { form_id?: string } }
        | undefined;
      const formId = content?.fields?.form_id;
      if (!formId) continue;
      out.push({ capId: obj.objectId, formId });
    }
    return out;
  }, [capsQuery.data]);

  const formsQuery = useSuiClientQuery(
    'multiGetObjects',
    {
      ids: capEntries.map((e) => e.formId),
      options: { showContent: true, showType: true },
    },
    { enabled: capEntries.length > 0 },
  );

  const templatesQuery = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: owner ?? '',
      filter: originalPackageId
        ? { StructType: `${originalPackageId}::template::FormTemplate` }
        : undefined,
      options: { showType: true, showContent: true },
    },
    { enabled: !!owner && !!originalPackageId },
  );

  const { running, ended } = useMemo(() => {
    const now = nowMs;
    const rows: OnChainForm[] = [];
    const results = formsQuery.data ?? [];
    for (let i = 0; i < results.length; i++) {
      const entry = results[i];
      const cap = capEntries[i];
      if (!entry || !cap || !entry.data?.content) continue;
      const content = entry.data.content as unknown as {
        dataType: 'moveObject';
        fields: {
          title?: string;
          closed?: boolean;
          site_object_id?: string | null | { Some?: string; vec?: string[] };
          settings?: {
            fields?: {
              access_mode?: number | string;
              closes_at_ms?: string | number;
              max_submissions?: string | number;
            };
          };
          stats?: { fields?: { submission_count?: string | number } };
        };
      };
      const fields = content.fields;
      const settings = fields.settings?.fields ?? {};
      const stats = fields.stats?.fields ?? {};
      // Form.site_object_id is Option<address>: serialised as the address
      // directly when Some, null when None.
      let siteObjectId: string | null = null;
      const rawSite = fields.site_object_id;
      if (typeof rawSite === 'string') {
        siteObjectId = normalizeSuiAddress(rawSite);
      } else if (rawSite && typeof rawSite === 'object') {
        const maybe =
          ('Some' in rawSite ? rawSite.Some : undefined) ??
          ('vec' in rawSite ? rawSite.vec?.[0] : undefined);
        if (maybe) siteObjectId = normalizeSuiAddress(maybe);
      }
      rows.push({
        capId: cap.capId,
        formId: cap.formId,
        title: fields.title ?? 'Untitled',
        closesAtMs: Number(settings.closes_at_ms ?? 0),
        maxSubmissions: Number(settings.max_submissions ?? 0),
        submissionCount: Number(stats.submission_count ?? 0),
        accessMode: Number(settings.access_mode ?? 0),
        closed: Boolean(fields.closed),
        siteObjectId,
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

  const templates = useMemo<OnChainTemplate[]>(() => {
    const pages = templatesQuery.data?.data ?? [];
    const out: OnChainTemplate[] = [];
    for (const entry of pages) {
      const obj = entry.data;
      if (!obj?.objectId) continue;
      const content = obj.content as unknown as
        | {
            dataType: 'moveObject';
            fields: {
              title?: string;
              description?: string;
              category?: number | string;
              clone_count?: number | string;
              creator?: string;
              tags?: string[];
            };
          }
        | undefined;
      if (!content?.fields) continue;
      out.push({
        templateId: obj.objectId,
        title: content.fields.title ?? 'Untitled template',
        description: content.fields.description ?? '',
        category: Number(content.fields.category ?? 0),
        cloneCount: Number(content.fields.clone_count ?? 0),
        creator: content.fields.creator ? normalizeSuiAddress(content.fields.creator) : '',
        tags: content.fields.tags ?? [],
      });
    }
    return out;
  }, [templatesQuery.data]);

  const isLoading =
    (!!owner && capsQuery.isPending) ||
    (capEntries.length > 0 && formsQuery.isPending) ||
    (!!owner && templatesQuery.isPending);
  const error =
    (capsQuery.error as Error | null) ??
    (formsQuery.error as Error | null) ??
    (templatesQuery.error as Error | null) ??
    null;

  void network;
  return { running, ended, templates, isLoading, error, packageMissing };
}
