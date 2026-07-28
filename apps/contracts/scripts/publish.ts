/**
 * First-time publish of the walform Move package to Sui testnet.
 *
 *   bun run publish
 *
 * Reads deployer keypair from .env.local (SUI_DEPLOYER_PRIVATE_KEY) or falls
 * back to the Sui CLI's active address. Writes captured ids into
 * `deployed.json` and mirrors them into .env.local (commented-out section).
 *
 * After publish, run `bun run codegen` to regenerate TS bindings, then
 * `bun run typecheck` in the root workspace.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

import { GrpcWebFetchTransport, SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";

// -----------------------------------------------------------------------------

loadEnv({ path: resolve(import.meta.dir, "../.env.local") });

const NETWORK = (process.env.SUI_NETWORK ?? "testnet") as
  | "testnet"
  | "mainnet"
  | "devnet"
  | "localnet";

const DEPLOYED_JSON = resolve(import.meta.dir, "../deployed.json");

// -----------------------------------------------------------------------------

async function main() {
  const keypair = loadDeployerKeypair();
  const address = keypair.toSuiAddress();
  // gRPC, not JSON-RPC: Sui decommissioned public JSON-RPC (testnet's endpoint
  // already answers 404, mainnet's switches off 2026-07-31). `SUI_GRPC_URL`
  // overrides the official fullnode.
  const client = new SuiGrpcClient({
    network: NETWORK,
    transport: new GrpcWebFetchTransport({
      baseUrl: process.env.SUI_GRPC_URL ?? `https://fullnode.${NETWORK}.sui.io`,
    }),
  });

  console.log(`Deployer: ${address}`);
  console.log(`Network:  ${NETWORK}`);

  // 1. Compile + emit bytecode via the Sui CLI (handles Move dep resolution for us).
  const buildOutput = JSON.parse(
    execSync("sui move build --dump-bytecode-as-base64 --path .", {
      cwd: resolve(import.meta.dir, ".."),
    }).toString(),
  ) as { modules: string[]; dependencies: string[]; digest?: number[] };

  console.log(
    `Compiled ${buildOutput.modules.length} modules, ${buildOutput.dependencies.length} deps`,
  );

  // 2. Build the publish transaction.
  const tx = new Transaction();
  const upgradeCap = tx.publish({
    modules: buildOutput.modules,
    dependencies: buildOutput.dependencies,
  });
  tx.transferObjects([upgradeCap], address);
  tx.setSender(address);

  // 3. Execute.
  const executed = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    include: { effects: true, objectTypes: true },
  });
  const result = executed.Transaction ?? executed.FailedTransaction;

  if (!result?.status.success) {
    console.error("Publish failed:", result?.status.error);
    process.exit(1);
  }

  // 4. Extract the ids we care about. Over gRPC, JSON-RPC's `objectChanges`
  // becomes `effects.changedObjects` (what changed, and how) plus an
  // `objectTypes` map (id → Move type).
  const objectTypes = result.objectTypes ?? {};
  const created = (result.effects?.changedObjects ?? []).filter(
    (c) => c.idOperation === "Created",
  );

  // A published package is a `PackageWrite`, not a Move object — it has no
  // entry in `objectTypes`, which is exactly what distinguishes it here.
  const packageId = created.find((c) => c.outputState === "PackageWrite")?.objectId;
  if (!packageId) {
    console.error("No package id among the created objects — aborting.");
    process.exit(1);
  }

  const upgradeCapId = findObjectId(created, objectTypes, "0x2::package::UpgradeCap");
  const publisherId = findObjectId(created, objectTypes, "0x2::package::Publisher");
  const transferPolicyId = findObjectId(
    created,
    objectTypes,
    `0x2::transfer_policy::TransferPolicy<${packageId}::template::FormTemplate>`,
  );
  const transferPolicyCapId = findObjectId(
    created,
    objectTypes,
    `0x2::transfer_policy::TransferPolicyCap<${packageId}::template::FormTemplate>`,
  );
  const platformTreasuryId = findObjectId(
    created,
    objectTypes,
    `${packageId}::template::PlatformTreasury`,
  );
  const platformAdminCapId = findObjectId(
    created,
    objectTypes,
    `${packageId}::template::PlatformAdminCap`,
  );

  if (!transferPolicyId) {
    console.error(
      "TransferPolicy<FormTemplate> not created — template::init failed silently. Aborting.",
    );
    process.exit(1);
  }

  const deployed = {
    network: NETWORK,
    packageId,
    originalPackageId: packageId, // unchanged across upgrades — Seal keys on this
    publishedAt: new Date().toISOString(),
    publishTxDigest: result.digest,
    publisherAddress: address,
    upgradeCap: upgradeCapId,
    publisher: publisherId,
    transferPolicy: transferPolicyId,
    transferPolicyCap: transferPolicyCapId,
    platformTreasury: platformTreasuryId,
    platformAdminCap: platformAdminCapId,
    notes:
      "Written by scripts/publish.ts. originalPackageId MUST stay stable across upgrades (Seal identity prefix).",
  };

  writeFileSync(DEPLOYED_JSON, JSON.stringify(deployed, null, 2) + "\n");
  console.log(`\nWrote ${DEPLOYED_JSON}`);
  console.log(deployed);
}

// -----------------------------------------------------------------------------

function loadDeployerKeypair(): Ed25519Keypair {
  const privKey = process.env.SUI_DEPLOYER_PRIVATE_KEY;
  if (privKey) {
    const { secretKey } = decodeSuiPrivateKey(privKey);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }

  // Fall back to whatever `sui client active-address` resolves to. We can't
  // easily exfiltrate the keystore's private key from the Sui CLI; for CLI
  // fallback we expect the user to instead run `sui client publish` directly.
  console.error(
    "SUI_DEPLOYER_PRIVATE_KEY not set. For local dev, either:\n" +
      "  1. Export your active key: sui keytool export --key-identity $(sui client active-address)\n" +
      "     and paste into .env.local as SUI_DEPLOYER_PRIVATE_KEY, or\n" +
      "  2. Run `sui client publish --gas-budget 200000000` directly from this directory\n" +
      "     and fill apps/contracts/deployed.json by hand.",
  );
  process.exit(1);
}

function findObjectId(
  created: { objectId: string }[],
  objectTypes: Record<string, string>,
  objectType: string,
): string | null {
  return created.find((c) => objectTypes[c.objectId] === objectType)?.objectId ?? null;
}

// -----------------------------------------------------------------------------

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
