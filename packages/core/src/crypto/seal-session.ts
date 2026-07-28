'use client';

import { SessionKey } from '@mysten/seal';
import type { ClientWithCoreApi } from '@mysten/sui/client';

export interface CreateSealSessionKeyInput {
  address: string;
  packageId: string;
  /** Any client exposing the shared `core` API — this app injects gRPC. */
  suiClient: ClientWithCoreApi;
  ttlMin: number;
  signPersonalMessage: (bytes: Uint8Array) => Promise<string>;
}

/**
 * Create a Seal SessionKey signed by the connected wallet. Wire the
 * `signPersonalMessage` callback to dApp Kit's `useSignPersonalMessage` hook.
 * The caller is responsible for caching the returned SessionKey for its TTL
 * (dApp Kit's QueryClient is a natural home).
 */
export async function createSealSessionKey(input: CreateSealSessionKeyInput): Promise<SessionKey> {
  const sk = await SessionKey.create({
    address: input.address,
    packageId: input.packageId,
    ttlMin: input.ttlMin,
    suiClient: input.suiClient,
  });
  const personalMessage = sk.getPersonalMessage();
  const signature = await input.signPersonalMessage(personalMessage);
  await sk.setPersonalMessageSignature(signature);
  return sk;
}
