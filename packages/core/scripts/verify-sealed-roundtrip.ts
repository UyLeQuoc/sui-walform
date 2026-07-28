#!/usr/bin/env bun
/**
 * End-to-end proof that a Private (allowlist) form's SEALED SCHEMA and its
 * encrypted responses are both readable by the creator — i.e. the fix for
 * github.com/UyLeQuoc/sui-walform#12 — over the gRPC transport and the
 * Enoki-authenticated mainnet Seal committee.
 *
 * Runs headless: `SessionKey.create({ signer })` takes a keypair, so nothing
 * here pops a wallet. It drives the SAME helpers the browser does
 * (`buildCreateFormTx`, `sealEncryptSchema`, `sealDecryptFormSchema`,
 * `sealEncryptSubmission`, `sealDecryptSubmission`), so a pass here means the
 * UI path works, not merely that some parallel script does.
 *
 *   bun run packages/core/scripts/verify-sealed-roundtrip.ts [mainnet|testnet]
 *
 * ⚠️ SPENDS GAS and writes a throwaway form to the chosen network. The form is
 * closed at the end so it stops accepting submissions.
 *
 * Key: SUI_DEPLOYER_PRIVATE_KEY (env, or apps/contracts/.env).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SessionKey } from '@mysten/seal';
import { normalizeSuiAddress } from '@mysten/sui/utils';

import { getSuiGrpcClient } from '../src/sui/grpc/client';
import { getSealClient } from '../src/crypto/seal-client';
import { sealEncryptSchema, sealDecryptFormSchema } from '../src/crypto/seal-schema';
import { sealEncryptSubmission, sealDecryptSubmission } from '../src/crypto/seal-submission';
import { getSealConfig } from '../src/sui/env-network';
import { buildCreateFormTx } from '../src/sui/tx/create-form';
import { buildUpdateSchemaTx } from '../src/sui/tx/update-schema';
import { buildSubmitTx } from '../src/sui/tx/submit';
import { buildCloseFormTx } from '../src/sui/tx/close-form';
import { extractPublishIds } from '../src/sui/tx/extract-form-ids';

const NETWORK = (process.argv[2] ?? 'mainnet') as 'mainnet' | 'testnet';
const REPO = resolve(import.meta.dir, '../../..');

// The builder's .env.local is the source of truth for package ids + Seal config;
// `getSealConfig` / the package-id readers all go through `process.env`, so load
// it into the process the same way the Vite `define` step would at build time.
function loadEnv(path: string): void {
  let text: string;
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnv(resolve(REPO, 'apps/builder/.env.local'));
loadEnv(resolve(REPO, 'apps/contracts/.env'));

const UP = NETWORK.toUpperCase();
const PACKAGE_ID = process.env[`NEXT_PUBLIC_PACKAGE_ID_${UP}`]!;
const ORIGINAL_PACKAGE_ID = process.env[`NEXT_PUBLIC_ORIGINAL_PACKAGE_ID_${UP}`]!;

let pass = 0;
let fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}`);
  if (!ok) console.log(`        got      ${JSON.stringify(actual)}\n        expected ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}

// A schema shaped like a real one, with a dropdown — the field type the issue
// reporter used.
const SCHEMA = {
  id: 'verify-sealed-roundtrip',
  version: 1,
  title: 'Sealed round-trip check',
  description: 'Throwaway form created by verify-sealed-roundtrip.ts',
  fields: [
    { id: 'q_choice', type: 'dropdown', label: 'Pick one', required: true, options: ['A', 'B', 'C'] },
    { id: 'q_text', type: 'short_text', label: 'Say something', required: false },
  ],
  settings: { submitLabel: 'Submit', primaryColor: 'default', fontFamily: 'inter', borderRadius: 2 },
};
const ANSWERS = { q_choice: 'B', q_text: 'hello from the round-trip check' };

async function main() {
  const pk = process.env.SUI_DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('SUI_DEPLOYER_PRIVATE_KEY not set (env or apps/contracts/.env)');
  const keypair = Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(pk).secretKey);
  const sender = keypair.toSuiAddress();

  const client = getSuiGrpcClient(NETWORK);
  const sealConfig = getSealConfig(NETWORK);
  if (!sealConfig) throw new Error(`Seal not configured for ${NETWORK}`);
  const seal = getSealClient(client, sealConfig);

  console.log(`network   ${NETWORK}`);
  console.log(`sender    ${sender}`);
  console.log(`package   ${PACKAGE_ID}`);
  console.log(`seal      ${sealConfig.keyServers}`);
  console.log(`seal auth ${sealConfig.apiKeyName ? `${sealConfig.apiKeyName}: <set>` : '(none)'}`);

  const exec = async (transaction: Parameters<typeof client.signAndExecuteTransaction>[0]['transaction'], label: string) => {
    const res = await client.signAndExecuteTransaction({
      transaction,
      signer: keypair,
      include: { effects: true },
    });
    const tx = res.Transaction ?? res.FailedTransaction;
    if (!tx?.status.success) throw new Error(`${label} failed: ${JSON.stringify(tx?.status.error)}`);
    await client.core.waitForTransaction({ digest: tx.digest });
    return tx.digest;
  };

  // ── 1. Publish a Private form with a placeholder schema ────────────────────
  console.log('\n1. publish Private form (placeholder schema)');
  const publishDigest = await exec(
    buildCreateFormTx({
      packageId: PACKAGE_ID,
      sender,
      title: SCHEMA.title,
      schemaBytes: new Uint8Array([0]), // same placeholder the sealed publish path writes
      themeBytes: new TextEncoder().encode(JSON.stringify({ primaryColor: 'default' })),
      settings: { accessMode: 1 },
      allowlistMembers: [sender],
    }),
    'create_form',
  );
  const ids = await extractPublishIds(client, publishDigest, ORIGINAL_PACKAGE_ID);
  if (!ids.formObjectId || !ids.formOwnerCapId || !ids.allowlistId) {
    throw new Error(`missing ids from publish: ${JSON.stringify(ids)}`);
  }
  console.log(`   form      ${ids.formObjectId}`);
  console.log(`   allowlist ${ids.allowlistId}`);

  // ── 2. Seal the schema (publish flow's follow-up) ──────────────────────────
  console.log('\n2. seal schema + update_schema');
  const plaintextSchema = new TextEncoder().encode(JSON.stringify(SCHEMA));
  const { ciphertext: schemaCipher } = await sealEncryptSchema({
    seal,
    packageId: ORIGINAL_PACKAGE_ID,
    objectId: ids.formObjectId,
    plaintext: plaintextSchema,
  });
  await exec(
    buildUpdateSchemaTx({
      packageId: PACKAGE_ID,
      formObjectId: ids.formObjectId,
      formOwnerCapId: ids.formOwnerCapId,
      schemaBytes: schemaCipher,
    }),
    'update_schema',
  );
  console.log(`   ciphertext ${schemaCipher.length} bytes`);

  // ── 3. Submit an encrypted response ────────────────────────────────────────
  console.log('\n3. submit encrypted response');
  const { ciphertext: bodyCipher, nonce } = await sealEncryptSubmission({
    seal,
    packageId: ORIGINAL_PACKAGE_ID,
    formObjectId: ids.formObjectId,
    plaintext: new TextEncoder().encode(JSON.stringify(ANSWERS)),
  });
  const submitDigest = await exec(
    buildSubmitTx({
      packageId: PACKAGE_ID,
      formObjectId: ids.formObjectId,
      allowlistObjectId: ids.allowlistId,
      encryptedBody: bodyCipher,
      fileBlobIds: [],
      nonce,
    }),
    'submit',
  );
  const submitIds = await extractPublishIds(client, submitDigest, ORIGINAL_PACKAGE_ID);
  void submitIds;
  const submissionId = await findSubmissionId(client, submitDigest, ORIGINAL_PACKAGE_ID);
  console.log(`   submission ${submissionId}`);

  // ── 4. Decrypt, headless ───────────────────────────────────────────────────
  console.log('\n4. decrypt as creator (SessionKey signed by the keypair, no wallet)');
  const sessionKey = await SessionKey.create({
    address: sender,
    packageId: ORIGINAL_PACKAGE_ID,
    ttlMin: 10,
    signer: keypair,
    suiClient: client,
  });

  const decryptedSchemaBytes = await sealDecryptFormSchema({
    seal,
    sessionKey,
    client,
    packageId: PACKAGE_ID,
    formObjectId: ids.formObjectId,
    allowlistObjectId: ids.allowlistId,
    ciphertext: schemaCipher,
  });
  const decryptedSchema = JSON.parse(new TextDecoder().decode(decryptedSchemaBytes));

  const decryptedBodyBytes = await sealDecryptSubmission({
    seal,
    sessionKey,
    client,
    packageId: PACKAGE_ID,
    formObjectId: ids.formObjectId,
    submissionObjectId: submissionId,
    ciphertext: bodyCipher,
    nonce,
  });
  const decryptedAnswers = JSON.parse(new TextDecoder().decode(decryptedBodyBytes));

  // ── 5. Assert ──────────────────────────────────────────────────────────────
  console.log('\n5. assertions');
  check('schema round-trips byte-identical', decryptedSchema, SCHEMA);
  check('schema exposes the questions', decryptedSchema.fields.map((f: { label: string }) => f.label), [
    'Pick one',
    'Say something',
  ]);
  check('dropdown options survive', decryptedSchema.fields[0].options, ['A', 'B', 'C']);
  check('answers round-trip', decryptedAnswers, ANSWERS);
  // The exact failure in issue #12: answers exist but there are no questions to
  // line them up against, so Results renders blank columns.
  const fieldIds: string[] = decryptedSchema.fields.map((f: { id: string }) => f.id);
  check(
    'every answer maps to a decrypted field id',
    Object.keys(decryptedAnswers).every((k) => fieldIds.includes(k)),
    true,
  );

  // ── 6. Clean up ────────────────────────────────────────────────────────────
  console.log('\n6. close the throwaway form');
  await exec(
    buildCloseFormTx({
      packageId: PACKAGE_ID,
      formObjectId: ids.formObjectId,
      capObjectId: ids.formOwnerCapId,
    }),
    'close_form',
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(`form (closed): ${ids.formObjectId}`);
  if (fail > 0) process.exit(1);
}

/** Created `::submission::Submission` id out of a submit tx. */
async function findSubmissionId(
  client: ReturnType<typeof getSuiGrpcClient>,
  digest: string,
  originalPackageId: string,
): Promise<string> {
  const res = await client.core.waitForTransaction({
    digest,
    include: { effects: true, objectTypes: true },
  });
  const tx = res.Transaction ?? res.FailedTransaction;
  const types = tx?.objectTypes ?? {};
  for (const c of tx?.effects?.changedObjects ?? []) {
    if (c.idOperation !== 'Created') continue;
    const t = types[c.objectId];
    if (t && t.startsWith(normalizeSuiAddress(originalPackageId)) && t.endsWith('::submission::Submission')) {
      return c.objectId;
    }
  }
  throw new Error('no Submission created by the submit tx');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
