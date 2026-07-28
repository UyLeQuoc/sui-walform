'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import type { FormSchema } from '../../types';
import { Form } from '../../sui/gen/walform/form';
import { getMoveObject, type ParsedMoveObject } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import { useOriginalPackageId } from '../../sui/package-id';

export interface FormOnChainDetail {
  formObjectId: string;
  owner: string;
  title: string;
  schema: FormSchema | null;
  schemaRaw: Uint8Array;
  /**
   * True when `schemaRaw` holds a Seal ciphertext rather than plaintext JSON —
   * i.e. the form was published with `NEXT_PUBLIC_ENABLE_SEALED_SCHEMA=true`
   * (Private/allowlist forms only). Consumers must decrypt via
   * `useSealedSchemaDecrypt` before they have any fields to render.
   *
   * A 1-byte body is the publish-time placeholder, not a ciphertext: the
   * sealed flow writes `[0]` first and overwrites it with the real ciphertext
   * in a follow-up `update_schema`. If that follow-up never landed the form is
   * broken rather than sealed, so it stays out of this flag.
   */
  schemaSealed: boolean;
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

type ParsedForm = ParsedMoveObject<ReturnType<typeof Form.parse>>;

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
  const client = useSuiGrpcClient();

  const objectQuery = useQuery<ParsedForm | null>({
    // `[network, …]` prefix is load-bearing: `useInvalidateChainQueries`
    // invalidates the whole network subtree after every mutation.
    queryKey: [network, 'walform:form', formId ?? null],
    enabled: !!formId,
    queryFn: ({ signal }) => getMoveObject(client, Form, formId!, signal),
  });

  const form = useMemo<FormOnChainDetail | null>(() => {
    const obj = objectQuery.data;
    if (!obj) return null;
    if (!isWalformFormType(obj.type, originalPackageId)) return null;
    const f = obj.fields;
    const schemaRaw = new Uint8Array(f.schema);
    const themeRaw = new Uint8Array(f.theme);

    let parsedSchema: FormSchema | null = null;
    if (schemaRaw.length > 0) {
      try {
        parsedSchema = JSON.parse(new TextDecoder().decode(schemaRaw)) as FormSchema;
      } catch {
        parsedSchema = null;
      }
    }

    let requiredTokenType = '';
    if (f.settings.required_token_type.length > 0) {
      try {
        requiredTokenType = new TextDecoder().decode(
          new Uint8Array(f.settings.required_token_type),
        );
      } catch {
        requiredTokenType = '';
      }
    }

    return {
      formObjectId: obj.objectId,
      owner: normalizeSuiAddress(f.owner),
      title: f.title || 'Untitled form',
      schema: parsedSchema,
      schemaRaw,
      schemaSealed: parsedSchema === null && schemaRaw.length > 1,
      themeRaw,
      closed: f.closed,
      accessMode: (Number(f.settings.access_mode) || 0) as 0 | 1 | 2 | 3,
      // BCS decodes `Option<address>` to the address or null — no
      // `{Some}`/`{vec}` wrapper shapes to unpick like JSON-RPC had.
      allowlistId: f.settings.allowlist_id ? normalizeSuiAddress(f.settings.allowlist_id) : null,
      maxSubmissions: Number(f.settings.max_submissions),
      closesAtMs: Number(f.settings.closes_at_ms),
      submissionFeeMist: BigInt(f.settings.submission_fee_mist),
      requiredTokenType,
      requiredTokenAmount: BigInt(f.settings.required_token_amount),
      submissionCount: Number(f.stats.submission_count),
      type: obj.type,
    };
  }, [objectQuery.data, originalPackageId]);

  return {
    form,
    isLoading: !!formId && objectQuery.isPending,
    error: (objectQuery.error as Error | null) ?? null,
  };
}

function isWalformFormType(type: string | undefined, originalPackageId: string | null): boolean {
  if (!type || !originalPackageId) return false;
  const [pkg, moduleName, structName] = type.split('::');
  if (!pkg) return false;
  return (
    moduleName === 'form' &&
    structName === 'Form' &&
    normalizeSuiAddress(pkg ?? '') === normalizeSuiAddress(originalPackageId)
  );
}
