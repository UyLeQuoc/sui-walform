import type { SuiGrpcClient } from '@mysten/sui/grpc';
import { getSuiGrpcClient } from './grpc/client';

export type SuiNetwork = 'testnet' | 'mainnet' | 'devnet' | 'localnet';

/**
 * Standalone (non-React) Sui client for the given network.
 *
 * gRPC, not JSON-RPC: Sui decommissioned public JSON-RPC (testnet already
 * 404s, mainnet off 2026-07-31). Inside React, prefer `useSuiGrpcClient()` —
 * it resolves the active network from context and shares this same per-network
 * instance.
 */
export function getSuiClient(network: SuiNetwork = 'testnet'): SuiGrpcClient {
  return getSuiGrpcClient(network);
}
