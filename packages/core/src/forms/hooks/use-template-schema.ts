'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import type { FormSchema } from '../../types';
import { FormTemplate } from '../../sui/gen/walform/template';
import { getMoveObject } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';

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
  const { network } = useSuiClientContext();
  const client = useSuiGrpcClient();

  const query = useQuery({
    queryKey: [network, 'walform:template-schema', templateId ?? null],
    enabled: enabled && !!templateId,
    queryFn: ({ signal }) => getMoveObject(client, FormTemplate, templateId!, signal),
  });

  const schemaBytes = query.data?.fields.schema;
  let schema: FormSchema | null = null;
  let schemaUnreadable = false;
  if (schemaBytes && schemaBytes.length > 0) {
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
