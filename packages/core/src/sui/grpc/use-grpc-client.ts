'use client';

import { useSuiClientContext } from '@mysten/dapp-kit';
import type { SuiGrpcClient } from '@mysten/sui/grpc';
import { getSuiGrpcClient } from './client';

/**
 * The active network's gRPC client, correctly typed.
 *
 * `SuiClientProvider` is already handed this exact instance (see
 * `../providers.tsx`), but dApp Kit types its context client as
 * `SuiJsonRpcClient`, so reading it through `useSuiClient()` forces a cast at
 * every call site. Resolving it from the same per-network cache instead keeps
 * one instance and zero casts — `getSuiGrpcClient` is memoized, so this is the
 * same object identity the provider injected.
 */
export function useSuiGrpcClient(): SuiGrpcClient {
  const { network } = useSuiClientContext();
  return getSuiGrpcClient(network);
}
