'use client';

import { useMemo } from 'react';
import { useSuiClientContext, useSuiClientQuery } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import type { FormSchema } from '../../types';
import { useOriginalPackageId } from '../../sui/package-id';

export interface FormOnChainDetail {
  formObjectId: string;
  owner: string;
  title: string;
  schema: FormSchema | null;
  schemaRaw: Uint8Array;
  themeRaw: Uint8Array;
  closed: boolean;
  accessMode: 0 | 1 | 2 | 3;
  allowlistId: string | null;
  maxSubmissions: number;
  closesAtMs: number;
  submissionFeeMist: bigint;
  /** UTF-8 string parsed from required_token_type bytes. Empty unless ACCESS_TOKEN. */
  requiredTokenType: string;
  requiredTokenAmount: bigint;
  submissionCount: number;
  /** Type tag (`originalPackageId::form::Form`) for sanity checks. */
  type: string;
}

/**
 * Fetch a `Form` object by id directly from chain. The submit page (`/f?formId=…`)
 * uses this to decide what UI to render: form schema, gating UI for private
 * forms, "form closed" banner, etc.
 */
export function useFormOnChain(formId: string | undefined): {
  form: FormOnChainDetail | null;
  isLoading: boolean;
  error: Error | null;
} {
  const originalPackageId = useOriginalPackageId();
  const { network } = useSuiClientContext();

  const objectQuery = useSuiClientQuery(
    'getObject',
    {
      id: formId ?? '',
      options: { showContent: true, showType: true, showOwner: true },
    },
    { enabled: !!formId },
  );

  const form = useMemo<FormOnChainDetail | null>(() => {
    if (!formId) return null;
    const data = objectQuery.data?.data;
    if (!data?.content) return null;
    const content = data.content as unknown as
      | {
          dataType: 'moveObject';
          type: string;
          fields: {
            owner?: string;
            title?: string;
            schema?: number[];
            theme?: number[];
            closed?: boolean;
            settings?: {
              fields?: {
                access_mode?: number | string;
                allowlist_id?: string | null | { Some?: string; vec?: string[] };
                closes_at_ms?: string | number;
                max_submissions?: string | number;
                submission_fee_mist?: string | number;
                required_token_type?: number[] | string;
                required_token_amount?: string | number;
              };
            };
            stats?: {
              fields?: {
                submission_count?: string | number;
              };
            };
          };
        }
      | undefined;
    if (!content?.fields) return null;
    const fields = content.fields;
    const settings = fields.settings?.fields ?? {};
    const stats = fields.stats?.fields ?? {};
    const schemaArr = fields.schema ?? [];
    const themeArr = fields.theme ?? [];
    const schemaRaw = new Uint8Array(schemaArr);
    const themeRaw = new Uint8Array(themeArr);

    let parsedSchema: FormSchema | null = null;
    if (schemaArr.length > 0) {
      try {
        parsedSchema = JSON.parse(new TextDecoder().decode(schemaRaw)) as FormSchema;
      } catch {
        parsedSchema = null;
      }
    }

    // allowlist_id is Option<address>; serialised as the address directly when
    // Some, null when None.
    let allowlistId: string | null = null;
    const rawAllowlist = settings.allowlist_id;
    if (typeof rawAllowlist === 'string') {
      allowlistId = normalizeSuiAddress(rawAllowlist);
    } else if (rawAllowlist && typeof rawAllowlist === 'object') {
      const maybe =
        ('Some' in rawAllowlist ? rawAllowlist.Some : undefined) ??
        ('vec' in rawAllowlist ? rawAllowlist.vec?.[0] : undefined);
      if (maybe) allowlistId = normalizeSuiAddress(maybe);
    }

    const accessMode = (Number(settings.access_mode ?? 0) || 0) as 0 | 1 | 2 | 3;
    let requiredTokenType = '';
    const rawTokenType = settings.required_token_type;
    if (Array.isArray(rawTokenType) && rawTokenType.length > 0) {
      try {
        requiredTokenType = new TextDecoder().decode(new Uint8Array(rawTokenType));
      } catch {
        requiredTokenType = '';
      }
    } else if (typeof rawTokenType === 'string') {
      requiredTokenType = rawTokenType;
    }
    return {
      formObjectId: data.objectId,
      owner: fields.owner ? normalizeSuiAddress(fields.owner) : '',
      title: fields.title ?? 'Untitled form',
      schema: parsedSchema,
      schemaRaw,
      themeRaw,
      closed: Boolean(fields.closed),
      accessMode,
      allowlistId,
      maxSubmissions: Number(settings.max_submissions ?? 0),
      closesAtMs: Number(settings.closes_at_ms ?? 0),
      submissionFeeMist: BigInt(settings.submission_fee_mist ?? 0),
      requiredTokenType,
      requiredTokenAmount: BigInt(settings.required_token_amount ?? 0),
      submissionCount: Number(stats.submission_count ?? 0),
      type: content.type,
    };
  }, [formId, objectQuery.data]);

  void originalPackageId;
  void network;
  return {
    form,
    isLoading: !!formId && objectQuery.isPending,
    error: (objectQuery.error as Error | null) ?? null,
  };
}
