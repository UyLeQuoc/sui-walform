import type { ClientWithCoreApi } from '@mysten/sui/client';
import type { WalrusClient } from '@mysten/walrus';
import {
  getWalrusUploadRelayHost,
  getWalrusUploadRelayTipMaxMist,
  type WalformNetwork,
} from '../sui/env-network';

const clients = new WeakMap<ClientWithCoreApi, Map<WalformNetwork, Promise<WalrusClient>>>();

/**
 * One relay-configured WalrusClient per (Sui client, network). Construction
 * pulls in the Walrus WASM bundle, so reuse matters.
 */
export function getWalrusClient(
  suiClient: ClientWithCoreApi,
  network: WalformNetwork,
): Promise<WalrusClient> {
  let byNetwork = clients.get(suiClient);
  if (!byNetwork) {
    byNetwork = new Map();
    clients.set(suiClient, byNetwork);
  }
  let client = byNetwork.get(network);
  if (!client) {
    client = import('@mysten/walrus').then(
      ({ WalrusClient }) =>
        new WalrusClient({
          network,
          suiClient,
          uploadRelay: {
            host: getWalrusUploadRelayHost(network),
            sendTip: { max: getWalrusUploadRelayTipMaxMist(network) },
          },
        }),
    );
    byNetwork.set(network, client);
  }
  return client;
}
