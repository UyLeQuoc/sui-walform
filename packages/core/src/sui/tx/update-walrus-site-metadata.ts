'use client';

import { Transaction } from '@mysten/sui/transactions';

export interface WalrusSiteMetadataInput {
  link: string | null;
  imageUrl: string | null;
  description: string | null;
  projectUrl: string | null;
  creator: string | null;
}

export interface BuildUpdateSiteMetadataTxInput {
  /** Walrus Sites Move package id (testnet canonical: 0x22b8c1…8dcb). */
  sitePackageId: string;
  siteObjectId: string;
  metadata: WalrusSiteMetadataInput;
}

/**
 * Replace the Site's metadata in one PTB:
 *   m = metadata::new_metadata(...)
 *   site::update_metadata(site, m)
 *
 * Each field is `Option<String>`: pass `null`/empty to clear; non-empty trims
 * to a single string. Walrus Sites stores metadata for portal/SuiNS display
 * — link is the SuiNS subname target, image_url decorates the site card on
 * marketplaces, etc.
 */
export function buildUpdateSiteMetadataTx(input: BuildUpdateSiteMetadataTxInput): Transaction {
  const tx = new Transaction();
  const pkg = input.sitePackageId;

  const m = input.metadata;
  const opt = (s: string | null) => {
    const trimmed = s?.trim();
    return tx.pure.option('string', trimmed ? trimmed : null);
  };

  const newMetadata = tx.moveCall({
    target: `${pkg}::metadata::new_metadata`,
    arguments: [
      opt(m.link),
      opt(m.imageUrl),
      opt(m.description),
      opt(m.projectUrl),
      opt(m.creator),
    ],
  });

  tx.moveCall({
    target: `${pkg}::site::update_metadata`,
    arguments: [tx.object(input.siteObjectId), newMetadata],
  });

  return tx;
}
