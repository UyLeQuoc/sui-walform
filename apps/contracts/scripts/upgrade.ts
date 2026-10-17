/**
 * Upgrade the walform package on one network, preserving `originalPackageId`
 * (Seal identities and every object type are keyed on it).
 *
 *   SUI_NETWORK=testnet bun run upgrade --dry-run          # simulate, print cost, stop
 *   SUI_NETWORK=testnet bun run upgrade --note "why"       # execute
 *
 * - Reads and writes ONLY `deployed.<network>.json` (mainnet also mirrors to
 *   the legacy `deployed.json`).
 * - Refuses to run if that file disagrees with the chain about the current
 *   version.
 * - `compatible` policy: old versions stay on-chain and callable; existing
 *   objects are untouched.
 * - Signs with the keystore key of the UpgradeCap owner via `sui keytool
 *   sign` — no private key in env or on disk.
 * - Appends the new version to `packageHistory` and re-renders PACKAGES.md.
 */
import { execFileSync } from "node:child_process";

import { Transaction, UpgradePolicy } from "@mysten/sui/transactions";

import {
  BUILDER_ENV,
  CONTRACTS_DIR,
  formatMist,
  grpcClient,
  readDeployment,
  renderPackageLog,
  resolveNetwork,
  signWithKeystore,
  syncPackageHistory,
  upsertEnvVar,
  withActiveEnv,
  writeDeployment,
  type Deployment,
  type Network,
} from "./lib/deployments";

const WALRUS_GIT_REV = "c8061f22c892f013f43d30c89485c8fa0682bffb";
const FRAMEWORK = new Set([
  "0x0000000000000000000000000000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000000000000000000000000000002",
]);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const network = resolveNetwork();
  const dryRun = process.argv.includes("--dry-run");
  const note = arg("note");

  const deployed = await syncPackageHistory(readDeployment(network));
  const client = grpcClient(network);
  const sender = deployed.publisherAddress;
  const current = deployed.packageHistory?.at(-1);

  console.log(`Network:            ${network}${dryRun ? "  (DRY RUN)" : ""}`);
  console.log(`Signer:             ${sender} (keystore)`);
  console.log(`Original package:   ${deployed.originalPackageId}`);
  console.log(`Current package:    ${deployed.packageId} (v${current?.version})`);

  const build = await withActiveEnv(network, async () =>
    JSON.parse(
      execFileSync(
        "sui",
        ["move", "build", "-e", network, "--dump-bytecode-as-base64", "--path", "."],
        { cwd: CONTRACTS_DIR, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
      ),
    ) as { modules: string[]; dependencies: string[]; digest: number[] },
  );
  const externalDeps = build.dependencies.filter((d) => !FRAMEWORK.has(d));
  console.log(`Compiled:           ${build.modules.length} modules`);
  console.log(`Linked deps:        ${externalDeps.join(", ") || "(framework only)"}`);

  const tx = new Transaction();
  const ticket = tx.moveCall({
    target: "0x2::package::authorize_upgrade",
    arguments: [
      tx.object(deployed.upgradeCap),
      tx.pure.u8(UpgradePolicy.COMPATIBLE),
      tx.pure.vector("u8", build.digest),
    ],
  });
  const receipt = tx.upgrade({
    modules: build.modules,
    dependencies: build.dependencies,
    package: deployed.packageId,
    ticket,
  });
  tx.moveCall({
    target: "0x2::package::commit_upgrade",
    arguments: [tx.object(deployed.upgradeCap), receipt],
  });
  tx.setSender(sender);
  const bytes = await tx.build({ client });

  const simulated = await client.simulateTransaction({
    transaction: bytes,
    include: { effects: true },
  });
  const sim = simulated.Transaction ?? simulated.FailedTransaction;
  if (!sim?.effects?.status.success) {
    console.error("Simulation failed:", JSON.stringify(sim?.effects?.status.error, null, 2));
    process.exit(1);
  }
  const gas = sim.effects.gasUsed;
  const net =
    BigInt(gas.computationCost) + BigInt(gas.storageCost) - BigInt(gas.storageRebate);
  console.log(
    `Estimated cost:     ${formatMist(net)}  (compute ${gas.computationCost}, storage ${gas.storageCost}, rebate ${gas.storageRebate} MIST)`,
  );
  if (dryRun) {
    console.log("\nDry run only — nothing was sent.");
    return;
  }

  const executed = await client.executeTransaction({
    transaction: bytes,
    signatures: [signWithKeystore(sender, bytes)],
    include: { effects: true },
  });
  const result = executed.Transaction ?? executed.FailedTransaction;
  if (!result?.effects?.status.success) {
    console.error("Upgrade failed:", JSON.stringify(result?.effects?.status.error, null, 2));
    process.exit(1);
  }
  await client.waitForTransaction({ digest: result.digest });

  // Over gRPC a published package appears in effects as a created PackageWrite.
  const newPackageId = result.effects.changedObjects.find(
    (c) => c.idOperation === "Created" && c.outputState === "PackageWrite",
  )?.objectId;
  if (!newPackageId) {
    console.error(`No new package among the created objects of ${result.digest} — aborting.`);
    process.exit(1);
  }

  const upgraded: Deployment = {
    ...deployed,
    packageId: newPackageId,
    previousPackageId: deployed.packageId,
    lastUpgradeAt: new Date().toISOString(),
    lastUpgradeTxDigest: result.digest,
    ...(externalDeps.length
      ? { walrusDependency: await labelWalrusDeps(network, externalDeps) }
      : {}),
  };
  const logged = await syncWhenIndexed(upgraded);
  const latest = logged.packageHistory?.at(-1);
  if (latest && note) latest.note = note;
  writeDeployment(logged);
  renderPackageLog();

  const envKey = `NEXT_PUBLIC_PACKAGE_ID_${network.toUpperCase()}`;
  console.log(`\nUpgraded to v${latest?.version}: ${newPackageId}`);
  console.log(`Tx:                 ${result.digest}`);
  console.log(`Modules added:      ${latest?.modulesAdded?.join(", ") || "—"}`);
  console.log(`Wrote deployed.${network}.json, PACKAGES.md`);
  console.log(`Env:                ${envKey} (${upsertEnvVar(BUILDER_ENV, envKey, newPackageId)})`);
}

/** The GraphQL indexer trails execution by a few seconds. */
async function syncWhenIndexed(d: Deployment): Promise<Deployment> {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      return await syncPackageHistory(d);
    } catch (err) {
      if (attempt === 19) throw err;
      await new Promise((r) => setTimeout(r, 3_000));
    }
  }
  throw new Error("unreachable");
}

async function labelWalrusDeps(
  network: Network,
  ids: string[],
): Promise<{ walrus: string; wal: string; gitRev: string }> {
  let walrus = "";
  let wal = "";
  for (const id of ids) {
    if (await hasModule(network, id, "wal")) wal = id;
    else walrus = id;
  }
  return { walrus, wal, gitRev: WALRUS_GIT_REV };
}

async function hasModule(network: Network, packageId: string, module: string): Promise<boolean> {
  const res = await fetch(`https://graphql.${network}.sui.io/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `query($id: SuiAddress!, $m: String!) { package(address: $id) { module(name: $m) { name } } }`,
      variables: { id: packageId, m: module },
    }),
  });
  const json = (await res.json()) as { data?: { package?: { module?: { name: string } | null } } };
  return !!json.data?.package?.module;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
