/**
 * Compat re-export — the canonical implementation lives in `env-network.ts`,
 * which resolves all per-network env vars (packageId, treasury, allowlist,
 * walrus, seal) symmetrically. Older imports of `useActivePackageId` /
 * `useOriginalPackageId` from this path keep working.
 */
export { useActivePackageId, useOriginalPackageId } from './env-network';
