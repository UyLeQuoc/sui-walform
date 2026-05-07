'use client';

import { useSuiClientContext } from '@mysten/dapp-kit';

/**
 * Current walform packageId for the active network. Bumps on every
 * `contracts:upgrade` — use this for MoveCall `target:` and for
 * `sealApproveReadSubmission`-style entry fn calls (you want the latest
 * module version).
 */
export function useActivePackageId(): string | null {
  const { network } = useSuiClientContext();
  if (network === 'testnet') {
    return process.env.NEXT_PUBLIC_PACKAGE_ID ?? null;
  }
  if (network === 'mainnet') {
    return process.env.NEXT_PUBLIC_PACKAGE_ID_MAINNET ?? null;
  }
  return null;
}

/**
 * The packageId at first publish — stable across every upgrade. Use this as
 * the `packageId` for `sealClient.encrypt({ packageId })` so ciphertexts
 * stay decryptable after a contract upgrade changes the active packageId.
 * Falls back to the active packageId if the env var is missing.
 */
export function useOriginalPackageId(): string | null {
  const { network } = useSuiClientContext();
  if (network === 'testnet') {
    return (
      process.env.NEXT_PUBLIC_ORIGINAL_PACKAGE_ID ?? process.env.NEXT_PUBLIC_PACKAGE_ID ?? null
    );
  }
  if (network === 'mainnet') {
    return process.env.NEXT_PUBLIC_PACKAGE_ID_MAINNET ?? null;
  }
  return null;
}
