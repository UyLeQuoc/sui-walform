'use client';

import { useSuiClientContext, useSuiClientQuery } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';

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
  void network;

  const objectQuery = useSuiClientQuery(
    'getObject',
    {
      id: siteObjectId ?? '',
      options: { showContent: true, showType: true },
    },
    { enabled: !!siteObjectId },
  );

  let site: WalrusSiteOnChain | null = null;
  if (siteObjectId && objectQuery.data?.data) {
    const data = objectQuery.data.data;
    const content = data.content as unknown as
      | {
          dataType: 'moveObject';
          fields: {
            name?: string;
            metadata?: {
              fields?: {
                link?: string | null | OptionField;
                image_url?: string | null | OptionField;
                description?: string | null | OptionField;
                project_url?: string | null | OptionField;
                creator?: string | null | OptionField;
              };
            };
          };
        }
      | undefined;
    const fields = content?.fields;
    const metaFields = fields?.metadata?.fields ?? {};
    site = {
      siteId: normalizeSuiAddress(data.objectId),
      name: fields?.name ?? '',
      metadata: {
        link: pickOption(metaFields.link),
        imageUrl: pickOption(metaFields.image_url),
        description: pickOption(metaFields.description),
        projectUrl: pickOption(metaFields.project_url),
        creator: pickOption(metaFields.creator),
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
