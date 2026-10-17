/**
 * True when a failure means the paying wallet has no SUI for gas. Covers the
 * wallet wording ("No valid gas coins"), the execution error
 * (GasBalanceTooLow) and the gRPC simulation error ("Unable to perform gas
 * selection due to insufficient SUI balance").
 */
export function isGasShortage(message: string): boolean {
  return /No valid gas coins|GasBalanceTooLow|gas selection|insufficient SUI/i.test(message);
}

/** What to tell a respondent whose wallet can't pay gas. */
export function noGasMessage(network: string, storageSponsored: boolean): string {
  const fix = network === 'testnet' ? 'Get some from the testnet faucet' : 'Add a little SUI';
  return storageSponsored
    ? `Gas sponsorship isn't available right now and your wallet has no SUI for gas. ${fix} and try again - the form still pays for storage.`
    : `Your wallet has no SUI to pay gas. ${fix} and try again.`;
}
