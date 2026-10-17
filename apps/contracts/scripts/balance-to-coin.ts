/**
 * Moves WAL or SUI from an address balance into a coin object owned by the
 * same address. Sui can now hold funds as an "address balance" instead of coin
 * objects, but the `walrus` CLI (1.55) — and so `site-builder deploy` — only
 * spends coin objects: it fails with "could not find WAL coins with
 * sufficient balance" (storage) or "could not find SUI coins with sufficient
 * balance" (it reserves one SUI coin ≥ `gas_budget`) while the funds sit in
 * the balance.
 *
 *   SUI_NETWORK=mainnet bun run apps/contracts/scripts/balance-to-coin.ts --coin WAL --amount 1
 *   SUI_NETWORK=mainnet bun run apps/contracts/scripts/balance-to-coin.ts --coin SUI --amount 0.3
 *
 * `--coin` is WAL (default) or SUI; `--amount` is whole units (default 1);
 * `--address` defaults to the deployer (the Walrus Site owner). Signed with the
 * local keystore. `--dry-run` builds (and so simulates) without sending.
 */
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";

import {
  grpcClient,
  readDeployment,
  resolveNetwork,
  signWithKeystore,
} from "./lib/deployments";

const WAL_TYPE = {
  mainnet:
    "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",
  testnet:
    "0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL",
} as const;
const SUI_TYPE = "0x2::sui::SUI";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const network = resolveNetwork();
  const owner = arg("address") ?? readDeployment(network).publisherAddress;
  if (!owner)
    throw new Error(
      "No --address and no publisherAddress in the deployment record.",
    );
  const amount = BigInt(Math.round(Number(arg("amount") ?? "1") * 1e9));
  const client = grpcClient(network);
  const coin = (arg("coin") ?? "WAL").toUpperCase();
  if (coin !== "WAL" && coin !== "SUI")
    throw new Error(`--coin must be WAL or SUI (got ${coin}).`);
  const coinType = coin === "SUI" ? SUI_TYPE : WAL_TYPE[network];

  const before = await client.core.getBalance({ owner, coinType });
  console.log(
    `${network} ${owner}\n${coin} coins ${Number(before.balance.coinBalance) / 1e9}, address balance ${Number(before.balance.addressBalance) / 1e9}`,
  );

  const tx = new Transaction();
  tx.setSender(owner);
  // Not from the gas coin: for SUI that would only reshuffle existing coins.
  tx.transferObjects(
    [coinWithBalance({ type: coinType, balance: amount, useGasCoin: false })],
    owner,
  );
  const bytes = await tx.build({ client });
  if (process.argv.includes("--dry-run")) {
    console.log(
      `Dry run: would move ${Number(amount) / 1e9} ${coin} into a coin object. Nothing sent.`,
    );
    return;
  }
  const res = await client.executeTransaction({
    transaction: bytes,
    signatures: [signWithKeystore(owner, bytes)],
    include: { effects: true },
  });
  const done = res.Transaction ?? res.FailedTransaction;
  if (!done?.effects?.status.success) {
    throw new Error(`failed: ${JSON.stringify(done?.effects?.status.error)}`);
  }
  await client.waitForTransaction({ digest: done.digest });

  const after = await client.core.getBalance({ owner, coinType });
  console.log(
    `Tx ${done.digest}\n${coin} coins ${Number(after.balance.coinBalance) / 1e9}, address balance ${Number(after.balance.addressBalance) / 1e9}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
