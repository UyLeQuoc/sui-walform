'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { getJsonObject } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';

export interface WalrusSiteMetadata {
  link: string | null;
  imageUrl: string | null;
  description: string | null;
  projectUrl: string | null;
  creator: string | null;
}

export interface WalrusSiteOnChain {
  siteId: string;
  /** Display name from `site::Site.name`. */
  name: string;
  metadata: WalrusSiteMetadata;
}

/**
 * Fetch the current state of a deployed Walrus Site (Mode B). Used by the
 * manage-site dialog to pre-fill the metadata editor with the on-chain values.
 *
 * Skips the query when `siteObjectId` is null/undefined — useful so callers
 * can pass `form.siteObjectId` unconditionally and let the hook decide.
 */
export function useFormSite(siteObjectId: string | null | undefined): {
  site: WalrusSiteOnChain | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { network } = useSuiClientContext();
  const client = useSuiGrpcClient();

  // `site::Site` belongs to the Walrus Sites package, so there's no generated
  // BCS struct for it here — read the gRPC `json` rendering instead. Every
  // field consumed below is a `String`/`Option<String>`, which JSON renders
  // unambiguously (the base64-vs-string trap only bites `vector<u8>`).
  const objectQuery = useQuery({
    queryKey: [network, 'walform:walrus-site', siteObjectId ?? null],
    enabled: !!siteObjectId,
    queryFn: ({ signal }) => getJsonObject(client, siteObjectId!, signal),
  });

  let site: WalrusSiteOnChain | null = null;
  if (siteObjectId && objectQuery.data) {
    const json = objectQuery.data.json as {
      name?: string;
      metadata?: Record<string, OptionField>;
    };
    const meta = json.metadata ?? {};
    site = {
      siteId: normalizeSuiAddress(objectQuery.data.objectId),
      name: json.name ?? '',
      metadata: {
        link: pickOption(meta['link']),
        imageUrl: pickOption(meta['image_url']),
        description: pickOption(meta['description']),
        projectUrl: pickOption(meta['project_url']),
        creator: pickOption(meta['creator']),
      },
    };
  }

  return {
    site,
    isLoading: !!siteObjectId && objectQuery.isPending,
    error: (objectQuery.error as Error | null) ?? null,
  };
}

type OptionField = { Some?: string; vec?: string[] } | string | null;

function pickOption(value: OptionField | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if ('Some' in value && typeof value.Some === 'string') return value.Some;
    if ('vec' in value && Array.isArray(value.vec) && typeof value.vec[0] === 'string') {
      return value.vec[0];
    }
  }
  return null;
}
