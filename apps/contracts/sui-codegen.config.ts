import type { SuiCodegenConfig } from "@mysten/codegen";

/**
 * Sui TypeScript codegen — emits typed bindings for every Move function +
 * struct into the shared `@walform/core` package. Builder + renderer then
 * import `{ walform }` from `@walform/core/sui/contract` and call
 * `walform.submission.submit(tx, { ... })` with full intellisense.
 *
 * Run after `bun run publish` (first deploy) or any `bun run upgrade`.
 */
const config: SuiCodegenConfig = {
  output: "../../packages/core/src/sui/gen",

  packages: [
    {
      // Local Move package — source of truth for the generated TS layer.
      // `path` points at the Move package root; `package` is the on-chain
      // id (stays "walform" until first publish, then swap for deployed.json's packageId).
      path: "./",
      package: "walform",
    },
  ],

  // `sui move summary` output lands under ./package_summaries/ — don't commit it.
  generateSummaries: true,

  // Skip framework transitive types we don't directly consume.
  prune: true,
};

export default config;
