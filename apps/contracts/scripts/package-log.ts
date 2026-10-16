/**
 * Rebuild the package version log from chain.
 *
 *   bun run package-log
 *
 * For each network: pulls every version of the walform package (GraphQL
 * `packageVersions` on the original id), writes it into
 * `deployed.<network>.json :: packageHistory` (keeping hand-written notes),
 * then renders `PACKAGES.md`. Aborts if a deployment file disagrees with the
 * chain about which version is current.
 */
import {
  readDeployment,
  renderPackageLog,
  syncPackageHistory,
  writeDeployment,
  type Network,
} from "./lib/deployments";

async function main() {
  for (const network of ["testnet", "mainnet"] as Network[]) {
    const synced = await syncPackageHistory(readDeployment(network));
    const first = synced.packageHistory?.[0];
    if (first && !first.note) first.note = "Initial publish";
    writeDeployment(synced);
    console.log(
      `${network}: ${synced.packageHistory?.length ?? 0} versions, current ${synced.packageId}`,
    );
  }
  renderPackageLog();
  console.log("Wrote PACKAGES.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
