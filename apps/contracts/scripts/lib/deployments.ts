/**
 * Shared plumbing for the contract scripts: per-network deployment records,
 * the package version log, keystore signing, and CLI env switching.
 *
 * Source of truth per network is `deployed.<network>.json`. `deployed.json`
 * is a legacy mirror of MAINNET kept for `publish.ts` /
 * `setup-public-allowlist.ts`; never read it to decide what to upgrade.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { GrpcWebFetchTransport, SuiGrpcClient } from "@mysten/sui/grpc";
import { toBase64 } from "@mysten/sui/utils";

export type Network = "testnet" | "mainnet";

export const CONTRACTS_DIR = resolve(import.meta.dir, "../..");
export const BUILDER_ENV = resolve(CONTRACTS_DIR, "../builder/.env.local");
const PACKAGE_LOG = resolve(CONTRACTS_DIR, "PACKAGES.md");
const LEGACY_MIRROR = resolve(CONTRACTS_DIR, "deployed.json");

export interface PackageVersionRecord {
  version: number;
  packageId: string;
  txDigest: string;
  at: string;
  /** Why this version exists. Hand-written or set by the script that created it. */
  note?: string;
  /** Modules this version added over the previous one. */
  modulesAdded?: string[];
}

export interface SponsorConfigRecord {
  objectId: string;
  createdAt: string;
  txDigest: string;
  /** Package version whose `sponsor_pool` module created it. */
  packageId: string;
  feeBps: number;
  maxStoragePricePerUnit: string;
  maxWritePricePerUnit: string;
  /** Live Walrus prices when the ceilings were set, for context. */
  walrusPricesAtCreation: { storagePerUnitPerEpoch: string; writePerUnit: string };
}

export interface Deployment {
  network: Network;
  packageId: string;
  originalPackageId: string;
  upgradeCap: string;
  publisherAddress: string;
  platformAdminCap: string;
  previousPackageId?: string;
  lastUpgradeAt?: string;
  lastUpgradeTxDigest?: string;
  /** Every on-chain version of the package, oldest first. */
  packageHistory?: PackageVersionRecord[];
  /** Walrus packages the current version links against. */
  walrusDependency?: { walrus: string; wal: string; gitRev: string };
  sponsorConfig?: SponsorConfigRecord;
  [key: string]: unknown;
}

export function resolveNetwork(): Network {
  const net = process.env.SUI_NETWORK ?? "testnet";
  if (net !== "testnet" && net !== "mainnet") {
    throw new Error(`SUI_NETWORK must be testnet or mainnet (got "${net}").`);
  }
  return net;
}

export function deploymentPath(network: Network): string {
  return resolve(CONTRACTS_DIR, `deployed.${network}.json`);
}

export function readDeployment(network: Network): Deployment {
  const d = JSON.parse(readFileSync(deploymentPath(network), "utf-8")) as Deployment;
  if (d.network !== network) {
    throw new Error(`deployed.${network}.json says network="${d.network}" — refusing to continue.`);
  }
  return d;
}

export function writeDeployment(d: Deployment): void {
  const body = JSON.stringify(d, null, 2) + "\n";
  writeFileSync(deploymentPath(d.network), body);
  if (d.network === "mainnet") writeFileSync(LEGACY_MIRROR, body);
}

export function grpcClient(network: Network): SuiGrpcClient {
  return new SuiGrpcClient({
    network,
    transport: new GrpcWebFetchTransport({
      baseUrl: process.env.SUI_GRPC_URL ?? `https://fullnode.${network}.sui.io`,
    }),
  });
}

// === On-chain package history ===================================================

async function graphql<T>(network: Network, query: string, variables: object): Promise<T> {
  const res = await fetch(
    process.env.SUI_GRAPHQL_URL ?? `https://graphql.${network}.sui.io/graphql`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    },
  );
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length || !json.data) {
    throw new Error(`GraphQL ${network}: ${json.errors?.map((e) => e.message).join("; ")}`);
  }
  return json.data;
}

interface OnChainVersion {
  version: number;
  packageId: string;
  txDigest: string;
  at: string;
  modules: string[];
}

export async function fetchPackageVersions(
  network: Network,
  originalPackageId: string,
): Promise<OnChainVersion[]> {
  const data = await graphql<{
    packageVersions: {
      nodes: {
        address: string;
        version: number;
        previousTransaction: { digest: string; effects: { timestamp: string } } | null;
        modules: { nodes: { name: string }[] };
      }[];
    };
  }>(
    network,
    `query($id: SuiAddress!) {
      packageVersions(address: $id, first: 50) {
        nodes {
          address version
          previousTransaction { digest effects { timestamp } }
          modules(first: 50) { nodes { name } }
        }
      }
    }`,
    { id: originalPackageId },
  );
  return data.packageVersions.nodes
    .map((n) => ({
      version: n.version,
      packageId: n.address,
      txDigest: n.previousTransaction?.digest ?? "",
      at: n.previousTransaction?.effects.timestamp ?? "",
      modules: n.modules.nodes.map((m) => m.name).sort(),
    }))
    .sort((a, b) => a.version - b.version);
}

/** Rebuilds `packageHistory` from chain, keeping any hand-written notes. */
export async function syncPackageHistory(d: Deployment): Promise<Deployment> {
  const onChain = await fetchPackageVersions(d.network, d.originalPackageId);
  const notes = new Map((d.packageHistory ?? []).map((h) => [h.version, h.note]));
  let prevModules: string[] = [];
  const packageHistory = onChain.map((v) => {
    const added = v.modules.filter((m) => !prevModules.includes(m));
    prevModules = v.modules;
    const record: PackageVersionRecord = {
      version: v.version,
      packageId: v.packageId,
      txDigest: v.txDigest,
      at: v.at,
      modulesAdded: added,
    };
    const note = notes.get(v.version);
    if (note) record.note = note;
    return record;
  });
  const latest = packageHistory.at(-1);
  if (latest && latest.packageId !== d.packageId) {
    throw new Error(
      `${d.network}: chain's latest version is ${latest.packageId} (v${latest.version}) but ` +
        `deployed.${d.network}.json says ${d.packageId}. Reconcile before continuing.`,
    );
  }
  return { ...d, packageHistory };
}

// === Human-readable log ==========================================================

export function renderPackageLog(): void {
  const lines: string[] = [
    "# WalForm package log",
    "",
    "Every on-chain version of the `walform` Move package, per network. Generated by",
    "`scripts/lib/deployments.ts :: renderPackageLog` from `deployed.<network>.json` —",
    "edit notes there (`packageHistory[].note`), then re-run `bun run package-log`.",
    "",
    "Upgrades are `compatible`: every version below stays on-chain and callable, and",
    "existing objects keep working. `originalPackageId` never changes — it is the Seal",
    "identity namespace and the type prefix of every WalForm object.",
    "",
  ];
  for (const network of ["mainnet", "testnet"] as const) {
    if (!existsSync(deploymentPath(network))) continue;
    const d = readDeployment(network);
    lines.push(`## ${network}`, "");
    lines.push(`- **Original package (stable):** \`${d.originalPackageId}\``);
    lines.push(`- **Current package:** \`${d.packageId}\``);
    lines.push(`- **UpgradeCap:** \`${d.upgradeCap}\` (owner \`${d.publisherAddress}\`)`);
    if (d.walrusDependency) {
      lines.push(
        `- **Linked Walrus:** walrus \`${d.walrusDependency.walrus}\`, wal \`${d.walrusDependency.wal}\` ` +
          `(git \`${d.walrusDependency.gitRev.slice(0, 12)}\`)`,
      );
    }
    if (d.sponsorConfig) {
      const c = d.sponsorConfig;
      lines.push(
        `- **SponsorConfig:** \`${c.objectId}\` — fee ${c.feeBps} bps, ceilings ` +
          `${c.maxStoragePricePerUnit} / ${c.maxWritePricePerUnit} FROST per unit ` +
          `(Walrus was ${c.walrusPricesAtCreation.storagePerUnitPerEpoch} / ` +
          `${c.walrusPricesAtCreation.writePerUnit}), created ${c.createdAt.slice(0, 10)} in \`${c.txDigest}\``,
      );
    }
    lines.push("", "| v | Package ID | Date (UTC) | Tx | Modules added | Note |", "|---|---|---|---|---|---|");
    for (const h of d.packageHistory ?? []) {
      lines.push(
        `| ${h.version} | \`${h.packageId}\` | ${h.at.slice(0, 16).replace("T", " ")} | ` +
          `\`${h.txDigest}\` | ${(h.modulesAdded ?? []).join(", ") || "—"} | ${h.note ?? ""} |`,
      );
    }
    lines.push("");
  }
  writeFileSync(PACKAGE_LOG, lines.join("\n"));
}

// === Signing via the sui keystore ================================================

/**
 * Signs tx bytes with the keystore key for `address` through `sui keytool
 * sign`. The private key never leaves the keystore; only this transaction's
 * signature does.
 */
export function signWithKeystore(address: string, txBytes: Uint8Array): string {
  const out = execFileSync(
    "sui",
    ["keytool", "--json", "sign", "--address", address, "--data", toBase64(txBytes)],
    { encoding: "utf-8" },
  );
  const parsed = JSON.parse(out) as { suiSignature?: string };
  if (!parsed.suiSignature) throw new Error("sui keytool sign returned no suiSignature");
  return parsed.suiSignature;
}

// === sui CLI env =================================================================

/**
 * Runs `fn` with the sui CLI switched to `network`, then restores the previous
 * env. `sui move build -e mainnet` resolves mainnet dependency objects through
 * the ACTIVE env, so building for one network while the CLI points at another
 * fails with "Object … not found".
 */
export async function withActiveEnv<T>(network: Network, fn: () => Promise<T>): Promise<T> {
  const previous = execFileSync("sui", ["client", "active-env"], { encoding: "utf-8" })
    .trim()
    .split("\n")
    .at(-1)
    ?.trim();
  if (previous !== network) execFileSync("sui", ["client", "switch", "--env", network]);
  try {
    return await fn();
  } finally {
    if (previous && previous !== network) execFileSync("sui", ["client", "switch", "--env", previous]);
  }
}

export function upsertEnvVar(envPath: string, key: string, value: string): string {
  if (!existsSync(envPath)) {
    writeFileSync(envPath, `${key}=${value}\n`);
    return "missing-file → created";
  }
  const original = readFileSync(envPath, "utf-8");
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(original)) {
    writeFileSync(envPath, original.replace(re, `${key}=${value}`));
    return "updated";
  }
  const suffix = original.endsWith("\n") ? "" : "\n";
  writeFileSync(envPath, `${original}${suffix}${key}=${value}\n`);
  return "appended";
}

export function formatMist(mist: bigint): string {
  return `${(Number(mist) / 1e9).toFixed(6)} SUI`;
}
