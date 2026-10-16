/**
 * Records where `referral` types live after the upgrade that added the module:
 * `referralTypesPackageId` in deployed.<network>.json and
 * NEXT_PUBLIC_REFERRAL_TYPES_PACKAGE_ID_<NET> in apps/builder/.env.local.
 * Sends no transaction — reads the package history `contracts:upgrade` wrote.
 *
 *   SUI_NETWORK=testnet bun run contracts:referral-config
 */
import {
  BUILDER_ENV,
  readDeployment,
  renderPackageLog,
  resolveNetwork,
  upsertEnvVar,
  writeDeployment,
} from "./lib/deployments";

function main() {
  const network = resolveNetwork();
  const d = readDeployment(network);
  // Types introduced by an upgrade are addressed by the version that introduced them.
  const introducing = d.packageHistory?.find((h) =>
    h.modulesAdded?.includes("referral"),
  );
  if (!introducing) {
    throw new Error(
      `${network}: no package version added referral yet — run the upgrade first.`,
    );
  }
  writeDeployment({ ...d, referralTypesPackageId: introducing.packageId });
  renderPackageLog();

  const key = `NEXT_PUBLIC_REFERRAL_TYPES_PACKAGE_ID_${network.toUpperCase()}`;
  console.log(
    `referral types:  ${introducing.packageId} (v${introducing.version})`,
  );
  console.log(
    `Env:             ${key} (${upsertEnvVar(BUILDER_ENV, key, introducing.packageId)})`,
  );
  console.log(
    `Next:            add ${introducing.packageId} to DEFAULT_PACKAGES.${network}.walform in supabase/functions/sponsor-transaction/index.ts and redeploy it.`,
  );
}

main();
