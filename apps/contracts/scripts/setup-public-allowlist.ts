/**
 * One-off setup: creates a globally-shared throwaway Allowlist used by the
 * public submission flow. `submission::submit()` requires an `&Allowlist`
 * argument even for ACCESS_PUBLIC forms (the contract ignores its contents
 * for public mode but the call shape stays uniform). Rather than create
 * a per-form allowlist on every publish, we share one global allowlist and
 * mirror its objectId into `NEXT_PUBLIC_PUBLIC_SUBMIT_ALLOWLIST_ID`.
 *
 * Run once per testnet deployment:
 *   bun run --cwd apps/contracts setup-public-allowlist
 *
 * The script:
 *   1. Loads the admin keypair from .env.local.
 *   2. Mints a tiny throwaway Form (Public, empty schema) so we have a valid
 *      FormOwnerCap to satisfy `allowlist::create(&cap, ctx)`.
 *   3. Creates + shares an Allowlist bound to that throwaway form.
 *   4. Prints the Allowlist objectId.
 *   5. The form-cap pair is left in the admin wallet — harmless, and the
 *      throwaway Form is shared so anyone could submit to it (irrelevant).
 */
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';

import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

loadEnv({ path: resolve(import.meta.dir, '../.env.local') });

const NETWORK = (process.env.SUI_NETWORK ?? 'testnet') as 'testnet' | 'mainnet' | 'devnet';
const DEPLOYED_JSON = resolve(import.meta.dir, '../deployed.json');

async function main() {
  const privKey = process.env.SUI_DEPLOYER_PRIVATE_KEY;
  if (!privKey) throw new Error('SUI_DEPLOYER_PRIVATE_KEY not set');
  const { secretKey } = decodeSuiPrivateKey(privKey);
  const admin = Ed25519Keypair.fromSecretKey(secretKey);
  const adminAddress = admin.toSuiAddress();

  const deployed = JSON.parse(readFileSync(DEPLOYED_JSON, 'utf-8')) as {
    packageId: string;
  };
  const packageId = deployed.packageId;

  const client = new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl(NETWORK),
    network: NETWORK,
  });

  console.log(`Admin:    ${adminAddress}`);
  console.log(`Network:  ${NETWORK}`);
  console.log(`Package:  ${packageId}`);

  const tx = new Transaction();

  // 1. new_settings(ACCESS_PUBLIC)
  const settings = tx.moveCall({
    target: `${packageId}::form::new_settings`,
    arguments: [
      tx.pure.u8(0),
      tx.pure.option('address', null),
      tx.pure.vector('u8', []),
      tx.pure.u64(0),
      tx.pure.u64(0),
      tx.pure.u64(0),
      tx.pure.u64(0),
    ],
  });

  // 2. (form, cap) = create_form
  const created = tx.moveCall({
    target: `${packageId}::form::create_form`,
    arguments: [
      tx.pure.string('walform-public-throwaway'),
      tx.pure.vector('u8', []),
      tx.pure.vector('u8', []),
      settings,
      tx.object.clock(),
    ],
  }) as unknown as [TransactionObjectArgument, TransactionObjectArgument];
  const formArg = created[0];
  const capArg = created[1];

  // 3. allowlist::create_and_share(&cap)
  tx.moveCall({
    target: `${packageId}::allowlist::create_and_share`,
    arguments: [capArg],
  });

  // 4. share form, transfer cap to admin
  tx.moveCall({
    target: `${packageId}::form::share`,
    arguments: [formArg],
  });
  tx.transferObjects([capArg], adminAddress);

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: admin,
    options: { showObjectChanges: true, showEffects: true },
  });

  if (result.effects?.status?.status !== 'success') {
    console.error('Tx failed:', result.effects?.status);
    process.exit(1);
  }

  const allowlistType = `${packageId}::allowlist::Allowlist`;
  const created_objs = (result.objectChanges ?? []) as Array<{
    type?: string;
    objectType?: string;
    objectId?: string;
  }>;
  const allowlist = created_objs.find(
    (c) => c.type === 'created' && c.objectType === allowlistType,
  );
  if (!allowlist?.objectId) {
    console.error('No Allowlist created in tx');
    process.exit(1);
  }

  console.log('');
  console.log(`✅ Public throwaway Allowlist created`);
  console.log(`   Tx digest:   ${result.digest}`);
  console.log(`   Allowlist:   ${allowlist.objectId}`);
  console.log('');
  console.log('Add to apps/builder/.env.local:');
  console.log(`   NEXT_PUBLIC_PUBLIC_SUBMIT_ALLOWLIST_ID=${allowlist.objectId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
