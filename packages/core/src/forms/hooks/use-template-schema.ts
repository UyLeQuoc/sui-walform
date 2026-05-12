'use client';

import { useSuiClientQuery } from '@mysten/dapp-kit';
import type { FormSchema } from '../../types';

export interface UseTemplateSchemaResult {
  schema: FormSchema | null;
  /** True when the on-chain bytes can't be parsed as the FormSchema JSON shape (sealed or corrupted). */
  schemaUnreadable: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * On-demand fetch + decode of a marketplace template's `schema` bytes. We
 * deliberately skip this in `useMarketplaceTemplates` to avoid pulling N×100KB
 * for templates the user never previews. Call this from the preview dialog
 * when it actually opens.
 */
export function useTemplateSchema(
  templateId: string | undefined,
  enabled = true,
): UseTemplateSchemaResult {
  const query = useSuiClientQuery(
    'getObject',
    {
      id: templateId ?? '',
      options: { showContent: true },
    },
    { enabled: enabled && !!templateId },
  );

  const content = query.data?.data?.content as unknown as
    | {
        dataType: 'moveObject';
        fields: { schema?: number[] };
      }
    | undefined;

  const schemaBytes = content?.fields?.schema;
  let schema: FormSchema | null = null;
  let schemaUnreadable = false;
  if (Array.isArray(schemaBytes) && schemaBytes.length > 0) {
    try {
      const decoded = new TextDecoder().decode(new Uint8Array(schemaBytes));
      schema = JSON.parse(decoded) as FormSchema;
    } catch {
      schemaUnreadable = true;
    }
  }

  return {
    schema,
    schemaUnreadable,
    isLoading: enabled && !!templateId && query.isPending,
    error: (query.error as Error | null) ?? null,
  };
}
