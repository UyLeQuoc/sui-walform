/**
 * Create (or retune) the platform `SponsorConfig` on one network.
 *
 *   SUI_NETWORK=testnet bun run sponsor-config --dry-run
 *   SUI_NETWORK=testnet bun run sponsor-config [--fee-bps 500] [--margin 1.25]
 *   SUI_NETWORK=testnet bun run sponsor-config --update [--fee-bps N] [--margin M]
 *
 * Price ceilings = live Walrus prices × margin. `settle` aborts when a
 * registration costs more than the ceilings allow, so re-run with `--update`
 * if Walrus raises prices past the margin. A wider margin tolerates bigger
 * price moves but lets a malicious PTB skim up to (1 - 1/margin) of each
 * sponsored registration's cost.
 *
 * Records the config (and the package that introduced `sponsor_pool`, whose
 * id prefixes its types and events) in deployed.<network>.json + PACKAGES.md,
 * and mirrors both ids into apps/builder/.env.local.
 */
import { execFileSync } from "node:child_process";

import { Transaction } from "@mysten/sui/transactions";

import {
  BUILDER_ENV,
  formatMist,
  grpcClient,
  readDeployment,
  renderPackageLog,
  resolveNetwork,
  signWithKeystore,
  upsertEnvVar,
  writeDeployment,
  type Deployment,
  type Network,
} from "./lib/deployments";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function livePrices(network: Network): { storage: bigint; write: bigint } {
  const info = JSON.parse(
    execFileSync("walrus", ["--context", network, "--json", "info"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  ) as { priceInfo: { storagePricePerUnitSize: number; writePricePerUnitSize: number } };
  return {
    storage: BigInt(info.priceInfo.storagePricePerUnitSize),
    write: BigInt(info.priceInfo.writePricePerUnitSize),
  };
}

/** Types introduced by an upgrade are addressed by the version that introduced them. */
async function sponsorTypesPackage(network: Network, d: Deployment): Promise<string> {
  const introducing = d.packageHistory?.find((h) => h.modulesAdded?.includes("sponsor_pool"));
  if (!introducing) {
    throw new Error(`${network}: no package version added sponsor_pool yet — run the upgrade first.`);
  }
  return introducing.packageId;
}

async function main() {
  const network = resolveNetwork();
  const dryRun = process.argv.includes("--dry-run");
  const update = process.argv.includes("--update");
  const d = readDeployment(network);
  const feeBps = Number(arg("fee-bps") ?? d.sponsorConfig?.feeBps ?? 500);
  const margin = Number(arg("margin") ?? 1.25);
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 2_000) {
    throw new Error("--fee-bps must be an integer in [0, 2000] (the contract caps it at 20%).");
  }
  if (!(margin >= 1)) throw new Error("--margin must be >= 1.");
  if (d.sponsorConfig && !update) {
    console.log(`${network} already has SponsorConfig ${d.sponsorConfig.objectId}. Use --update to retune.`);
    return;
  }
  if (update && !d.sponsorConfig) throw new Error(`${network} has no SponsorConfig to --update.`);

  const prices = livePrices(network);
  const scale = BigInt(Math.round(margin * 10_000));
  const storageCap = (prices.storage * scale + 9_999n) / 10_000n;
  const writeCap = (prices.write * scale + 9_999n) / 10_000n;
  const typesPackage = await sponsorTypesPackage(network, d);

  console.log(`Network:        ${network}${dryRun ? "  (DRY RUN)" : ""}${update ? "  (UPDATE)" : ""}`);
  console.log(`Package:        ${d.packageId}`);
  console.log(`Walrus live:    storage ${prices.storage} / write ${prices.write} FROST per unit`);
  console.log(`Ceilings (x${margin}): storage ${storageCap} / write ${writeCap}`);
  console.log(`Fee:            ${feeBps} bps`);

  const tx = new Transaction();
  if (update && d.sponsorConfig) {
    const config = tx.object(d.sponsorConfig.objectId);
    const admin = tx.object(d.platformAdminCap);
    tx.moveCall({
      target: `${d.packageId}::sponsor_pool::set_fee_bps`,
      arguments: [config, admin, tx.pure.u64(feeBps)],
    });
    tx.moveCall({
      target: `${d.packageId}::sponsor_pool::set_price_caps`,
      arguments: [config, admin, tx.pure.u64(storageCap), tx.pure.u64(writeCap)],
    });
  } else {
    tx.moveCall({
      target: `${d.packageId}::sponsor_pool::create_config_and_share`,
      arguments: [
        tx.object(d.platformAdminCap),
        tx.pure.u64(feeBps),
        tx.pure.u64(storageCap),
        tx.pure.u64(writeCap),
      ],
    });
  }
  tx.setSender(d.publisherAddress);
  const client = grpcClient(network);
  const bytes = await tx.build({ client });

  const sim = await client.simulateTransaction({ transaction: bytes, include: { effects: true } });
  const simTx = sim.Transaction ?? sim.FailedTransaction;
  if (!simTx?.effects?.status.success) {
    console.error("Simulation failed:", JSON.stringify(simTx?.effects?.status.error, null, 2));
    process.exit(1);
  }
  const g = simTx.effects.gasUsed;
  console.log(
    `Estimated cost: ${formatMist(BigInt(g.computationCost) + BigInt(g.storageCost) - BigInt(g.storageRebate))}`,
  );
  if (dryRun) {
    console.log("\nDry run only — nothing was sent.");
    return;
  }

  const executed = await client.executeTransaction({
    transaction: bytes,
    signatures: [signWithKeystore(d.publisherAddress, bytes)],
    include: { effects: true, objectTypes: true },
  });
  const result = executed.Transaction ?? executed.FailedTransaction;
  if (!result?.effects?.status.success) {
    console.error("Failed:", JSON.stringify(result?.effects?.status.error, null, 2));
    process.exit(1);
  }
  await client.waitForTransaction({ digest: result.digest });

  let objectId = d.sponsorConfig?.objectId;
  if (!update) {
    const types = result.objectTypes ?? {};
    objectId = result.effects.changedObjects.find(
      (c) =>
        c.idOperation === "Created" && types[c.objectId]?.endsWith("::sponsor_pool::SponsorConfig"),
    )?.objectId;
    if (!objectId) throw new Error(`No SponsorConfig among created objects of ${result.digest}.`);
    const type = types[objectId];
    if (!type?.startsWith(typesPackage)) {
      throw new Error(`SponsorConfig type ${type} is not under ${typesPackage} — check type origin.`);
    }
  }
  if (!objectId) throw new Error("unreachable: no config id");

  const updated: Deployment = {
    ...d,
    sponsorTypesPackageId: typesPackage,
    sponsorConfig: {
      objectId,
      createdAt: update && d.sponsorConfig ? d.sponsorConfig.createdAt : new Date().toISOString(),
      txDigest: update && d.sponsorConfig ? d.sponsorConfig.txDigest : result.digest,
      packageId: update && d.sponsorConfig ? d.sponsorConfig.packageId : d.packageId,
      feeBps,
      maxStoragePricePerUnit: storageCap.toString(),
      maxWritePricePerUnit: writeCap.toString(),
      walrusPricesAtCreation: {
        storagePerUnitPerEpoch: prices.storage.toString(),
        writePerUnit: prices.write.toString(),
      },
      ...(update ? { lastUpdatedAt: new Date().toISOString(), lastUpdateTxDigest: result.digest } : {}),
    },
  };
  writeDeployment(updated);
  renderPackageLog();

  const net = network.toUpperCase();
  console.log(`\n${update ? "Updated" : "Created"} SponsorConfig ${objectId}`);
  console.log(`Tx:             ${result.digest}`);
  console.log(
    `Env:            NEXT_PUBLIC_SPONSOR_CONFIG_ID_${net} (${upsertEnvVar(BUILDER_ENV, `NEXT_PUBLIC_SPONSOR_CONFIG_ID_${net}`, objectId)})`,
  );
  console.log(
    `Env:            NEXT_PUBLIC_SPONSOR_TYPES_PACKAGE_ID_${net} (${upsertEnvVar(BUILDER_ENV, `NEXT_PUBLIC_SPONSOR_TYPES_PACKAGE_ID_${net}`, typesPackage)})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
