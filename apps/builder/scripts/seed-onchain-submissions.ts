#!/usr/bin/env bun
/**
 * Seed N REAL on-chain submissions to a fresh PUBLIC WalForm form on testnet,
 * all signed by ONE keypair. The contract has no per-address dedup for public
 * forms (submission.move ACCESS_PUBLIC branch is a no-op), so one wallet can
 * submit unlimited times.
 *
 * Bodies are Seal-encrypted INLINE (full ciphertext stored in `encrypted_body`,
 * no Walrus pivot) so the creator can decrypt them in the Results dashboard —
 * the decrypt path treats a non-pointer body as inline ciphertext.
 *
 * Key resolution (first found wins):
 *   1. SUI_PRIVATE_KEY env   2. SUI_DEPLOYER_PRIVATE_KEY env
 *   3. SUI_DEPLOYER_PRIVATE_KEY in apps/contracts/.env  (read automatically)
 * The signer must hold TESTNET SUI for gas (1 create + N submit txs). NOTE: the
 * apps/contracts deployer key is a mainnet publisher — its TESTNET balance may
 * be 0, so faucet that address first: `sui client faucet` (testnet).
 *
 * Usage (from repo root):
 *   bun run --cwd apps/builder seed:submissions               # uses apps/contracts/.env key
 *   SUBMIT_COUNT=50 bun run --cwd apps/builder seed:submissions
 *   SUI_PRIVATE_KEY=suiprivkey1... bun apps/builder/scripts/seed-onchain-submissions.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { GrpcWebFetchTransport, SuiGrpcClient } from '@mysten/sui/grpc';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { SealClient } from '@mysten/seal';
import { buildCreateFormTx } from '@walform/core/sui/tx/create-form';
import { buildSubmitTx } from '@walform/core/sui/tx/submit';

// --- testnet config (mirrors apps/builder/.env.local; override via env) ------
const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PACKAGE_ID_TESTNET ??
  '0x61074d22c927255c82ba5e54c3a30ffb25a2dd3d2ceb8edf874de820a2ff1fa7';
const ORIGINAL_PACKAGE_ID =
  process.env.NEXT_PUBLIC_ORIGINAL_PACKAGE_ID_TESTNET ??
  '0x2d8b918defc43b3b72afe63364f9b974c636b5820082d9a64b031e5e6d977289';
const SEAL_COMMITTEE =
  process.env.NEXT_PUBLIC_SEAL_KEY_SERVERS_TESTNET ??
  '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98';
const SEAL_AGGREGATOR =
  process.env.NEXT_PUBLIC_SEAL_AGGREGATOR_URL_TESTNET ??
  'https://seal-aggregator-testnet.mystenlabs.com';
const SEAL_THRESHOLD = Number(process.env.NEXT_PUBLIC_SEAL_THRESHOLD ?? 1) || 1;
const COUNT = Number(process.env.SUBMIT_COUNT ?? 100);
/** Reuse an existing form (top up its submissions) instead of creating one.
 *  Set BOTH to skip the create step. */
const FORM_ID = process.env.FORM_ID;
const ALLOWLIST_ID = process.env.ALLOWLIST_ID;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT =
  /unavailable for consumption|needs to be rebuilt|rejected as invalid|equivocat|reserved for another/i;

// --- Seal identity (replicated from packages/core/src/crypto/seal-identity.ts)
const FORM_ID_BYTES = 32;
const NONCE_BYTES = 16;

function addressToBytes32(addr: string): Uint8Array {
  const hex = normalizeSuiAddress(addr).slice(2);
  const out = new Uint8Array(FORM_ID_BYTES);
  for (let i = 0; i < FORM_ID_BYTES; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function buildSubmissionIdentity(formId: string, nonce: Uint8Array): Uint8Array {
  const out = new Uint8Array(FORM_ID_BYTES + NONCE_BYTES);
  out.set(addressToBytes32(formId), 0);
  out.set(nonce, FORM_ID_BYTES);
  return out;
}

function identityToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// --- the seeded form (a few simple fields) -----------------------------------
const SCHEMA = {
  id: 'seed-form',
  title: 'Seed Test Form',
  description: 'Auto-generated form for on-chain submission load/demo testing.',
  fields: [
    { id: 'name', type: 'short_text', label: 'Your name', required: true },
    { id: 'email', type: 'email', label: 'Email', required: true },
    { id: 'score', type: 'number', label: 'Score (0–100)', required: false },
    { id: 'feedback', type: 'long_text', label: 'Any feedback?', required: false },
  ],
  settings: {
    submitLabel: 'Submit',
    successMessage: 'Thanks for your response!',
    submitAlignment: 'left',
    fontFamily: 'inter',
    borderRadius: 2,
    primaryColor: '#6366f1',
  },
};
const THEME = { primaryColor: '#6366f1', fontFamily: 'inter', borderRadius: 2 };

/** Read SUI_DEPLOYER_PRIVATE_KEY out of apps/contracts/.env (relative to this
 *  script) so you don't have to re-export it. Returns undefined if absent. */
function keyFromContractsEnv(): string | undefined {
  try {
    const text = readFileSync(resolve(import.meta.dir, '../../contracts/.env'), 'utf-8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*SUI_DEPLOYER_PRIVATE_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1]?.replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env on disk — fine, fall through */
  }
  return undefined;
}

/**
 * Find a created object by type suffix in a gRPC tx result. `effects` says
 * which objects the tx created; the `objectTypes` map says what they are.
 */
function findCreated(
  created: { objectId: string; idOperation: string }[],
  objectTypes: Record<string, string>,
  suffix: string,
): string | undefined {
  return created.find(
    (c) => c.idOperation === 'Created' && objectTypes[c.objectId]?.endsWith(suffix),
  )?.objectId;
}

async function main() {
  const pk =
    process.env.SUI_PRIVATE_KEY ?? process.env.SUI_DEPLOYER_PRIVATE_KEY ?? keyFromContractsEnv();
  if (!pk) {
    throw new Error(
      'No private key found. Set SUI_PRIVATE_KEY=suiprivkey1…, or put ' +
        'SUI_DEPLOYER_PRIVATE_KEY in apps/contracts/.env (read automatically).',
    );
  }
  const { secretKey } = decodeSuiPrivateKey(pk);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const sender = keypair.toSuiAddress();
  // gRPC — testnet's public JSON-RPC endpoint answers 404 as of 2026-07.
  const client = new SuiGrpcClient({
    network: 'testnet',
    transport: new GrpcWebFetchTransport({
      baseUrl: process.env.SUI_GRPC_URL ?? 'https://fullnode.testnet.sui.io',
    }),
  });

  console.info(`Signer (testnet): ${sender}`);

  // 1) get the target form — reuse FORM_ID/ALLOWLIST_ID or create a new one --
  let formObjectId: string | undefined;
  let allowlistId: string | undefined;

  if (FORM_ID && ALLOWLIST_ID) {
    formObjectId = FORM_ID;
    allowlistId = ALLOWLIST_ID;
    console.info(`Reusing form ${formObjectId} — adding ${COUNT} submissions…`);
  } else {
    console.info(`Creating 1 form + ${COUNT} submissions (each submit is a signed tx)…`);
    const createTx = buildCreateFormTx({
      packageId: PACKAGE_ID,
      sender,
      title: SCHEMA.title,
      schemaBytes: new TextEncoder().encode(JSON.stringify(SCHEMA)),
      themeBytes: new TextEncoder().encode(JSON.stringify(THEME)),
      settings: { accessMode: 0 },
      allowlistMembers: [],
    });
    const executed = await client.signAndExecuteTransaction({
      transaction: createTx,
      signer: keypair,
      include: { effects: true, objectTypes: true },
    });
    const created = executed.Transaction ?? executed.FailedTransaction;
    if (!created?.status.success) {
      throw new Error(`create_form failed: ${JSON.stringify(created?.status.error)}`);
    }
    // Let the fullnode index the new gas-coin version before the first submit.
    try {
      await client.core.waitForTransaction({ digest: created.digest });
    } catch {
      /* best-effort */
    }
    const changed = created.effects?.changedObjects ?? [];
    const objectTypes = created.objectTypes ?? {};
    formObjectId = findCreated(changed, objectTypes, '::form::Form');
    allowlistId = findCreated(changed, objectTypes, '::allowlist::Allowlist');
    if (!formObjectId || !allowlistId) {
      throw new Error('Could not resolve created Form / Allowlist from objectChanges.');
    }
    console.info(`\nForm created: ${formObjectId}`);
    console.info(`Allowlist:    ${allowlistId}\n`);
  }

  if (!formObjectId || !allowlistId) throw new Error('No target form/allowlist resolved.');

  // 2) Seal client (testnet committee; encrypt is client-side, no wallet) ----
  const seal = new SealClient({
    suiClient: client,
    serverConfigs: [{ objectId: SEAL_COMMITTEE, weight: 1, aggregatorUrl: SEAL_AGGREGATOR }],
    verifyKeyServers: false,
    timeout: 10_000,
  });

  // 3) loop submissions. Sequential + retry/backoff: each submit consumes the
  // signer's gas coin, bumping its version; the fullnode lags a moment, so a
  // back-to-back submit can hit "object version unavailable for consumption".
  // We waitForTransaction after each success, and rebuild + retry on transient
  // gas/version contention (a fresh tx re-selects the gas coin at its new
  // version). A failed (rejected) tx creates no Submission, so retry is safe.
  let ok = 0;
  for (let i = 1; i <= COUNT; i++) {
    const answers = {
      name: `Tester ${i}`,
      email: `tester${i}@walform.test`,
      score: (i * 7) % 101,
      feedback: `Auto seed submission #${i} — generated by seed-onchain-submissions.ts`,
    };
    const plaintext = new TextEncoder().encode(JSON.stringify(answers));
    const nonce = new Uint8Array(NONCE_BYTES);
    crypto.getRandomValues(nonce);
    const identity = buildSubmissionIdentity(formObjectId, nonce);

    let encryptedBody: Uint8Array;
    try {
      const enc = await seal.encrypt({
        threshold: SEAL_THRESHOLD,
        packageId: ORIGINAL_PACKAGE_ID,
        id: identityToHex(identity),
        data: plaintext,
      });
      encryptedBody = enc.encryptedObject;
    } catch (err) {
      console.error(`  #${i}/${COUNT} encrypt error:`, err instanceof Error ? err.message : err);
      continue;
    }

    let landed = false;
    for (let attempt = 0; attempt < 6 && !landed; attempt++) {
      if (attempt > 0) await sleep(500 * attempt);
      try {
        const submitTx = buildSubmitTx({
          packageId: PACKAGE_ID,
          formObjectId,
          allowlistObjectId: allowlistId,
          encryptedBody,
          fileBlobIds: [],
          nonce,
          share: true,
        });
        const executed = await client.signAndExecuteTransaction({
          transaction: submitTx,
          signer: keypair,
          include: { effects: true },
        });
        const res = executed.Transaction ?? executed.FailedTransaction;
        if (!res?.status.success) {
          throw new Error(JSON.stringify(res?.status.error));
        }
        landed = true;
        ok++;
        if (i % 10 === 0 || i === COUNT) {
          console.info(`  submitted ${ok}/${i} (latest ${res.digest})`);
        }
        try {
          await client.core.waitForTransaction({ digest: res.digest });
        } catch {
          /* best-effort sync before the next submit */
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!TRANSIENT.test(msg) || attempt === 5) {
          console.error(`  #${i}/${COUNT} failed: ${msg}`);
          break;
        }
        // transient gas/version contention — back off + rebuild + retry
      }
    }
  }

  console.info(`\nDone — ${ok}/${COUNT} submissions landed.`);
  console.info(`Results: http://localhost:3000/forms/results?formId=${formObjectId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
