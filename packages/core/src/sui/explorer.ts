export type ExplorerNetwork = 'testnet' | 'mainnet' | 'devnet';
export type ExplorerKind = 'object' | 'txblock' | 'account' | 'package';

const SUIVISION_TXBLOCK: Record<ExplorerKind, string> = {
  object: 'object',
  txblock: 'txblock',
  account: 'account',
  package: 'package',
};

/**
 * Suivision explorer URL for an on-chain resource on the active network.
 *
 * - `testnet`  → https://testnet.suivision.xyz/<kind>/<id>
 * - `devnet`   → https://devnet.suivision.xyz/<kind>/<id>
 * - `mainnet`  → https://suivision.xyz/<kind>/<id>   (no subdomain)
 */
export function suivisionUrl(network: ExplorerNetwork, kind: ExplorerKind, id: string): string {
  const subdomain = network === 'mainnet' ? '' : `${network}.`;
  return `https://${subdomain}suivision.xyz/${SUIVISION_TXBLOCK[kind]}/${id}`;
}
