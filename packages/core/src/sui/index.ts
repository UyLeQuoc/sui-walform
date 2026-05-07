import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

// Stub: returns a SuiJsonRpcClient configured for testnet.
// Fleshed out in the Sui / dApp-Kit wiring plan.
//
// Note: as of @mysten/sui 2.x the old SuiClient / getFullnodeUrl names
// were renamed to SuiJsonRpcClient / getJsonRpcFullnodeUrl and moved
// from /client to /jsonRpc.

export type SuiNetwork = 'testnet' | 'mainnet' | 'devnet' | 'localnet';

export function getSuiClient(network: SuiNetwork = 'testnet'): SuiJsonRpcClient {
  return new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl(network),
    network,
  });
}
