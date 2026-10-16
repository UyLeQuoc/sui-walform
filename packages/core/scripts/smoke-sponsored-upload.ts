#!/usr/bin/env bun
/**
 * End-to-end proof of pool-sponsored Walrus writes, driven through the SAME
 * service the browser uses (`walrus/sponsored-register.ts`):
 *
 *   - a throwaway respondent with 0 SUI / 0 WAL is the SENDER of every tx,
 *   - the form's SponsorPool pays the WAL (+ relay tips, + platform fee),
 *   - the deployer only sponsors gas (standing in for Enoki),
 *   - data reads back byte-for-byte from the aggregator.
 *
 *   bun run packages/core/scripts/smoke-sponsored-upload.ts
 *
 * Testnet only: it spends pool WAL, and the pool is refunded + the form closed
 * at the end. Signing uses the sui keystore (`sui keytool sign`) for the
 * deployer; no private key is read.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { coinWithBalance, Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { normalizeSuiAddress } from '@mysten/sui/utils';

import { signWithKeystore } from '../../../apps/contracts/scripts/lib/deployments';
import { getWalrusAggregatorUrl } from '../src/sui/env-network';
import {
  createPool,
  depositSui,
  depositWal,
  SponsorConfig,
  SponsorPool,
  SponsoredBlobRegistered,
  sharePool,
  withdrawSui,
  withdrawWal,
} from '../src/sui/gen/walform/sponsor_pool';
import { Submission } from '../src/sui/gen/walform/submission';
import { getSuiGrpcClient } from '../src/sui/grpc/client';
import { buildCloseFormTx } from '../src/sui/tx/close-form';
import { buildCreateFormTx } from '../src/sui/tx/create-form';
import { buildSubmitTx } from '../src/sui/tx/submit';
import { buildExtendSharedBlobsTx } from '../src/sui/tx/extend-shared-blobs';
import { extensionPlan } from '../src/forms/lib/walrus-storage';
import { findFormBlobs } from '../src/walrus/form-blobs';
import { getWalrusClient } from '../src/walrus/walrus-client';
import { extractPublishIds } from '../src/sui/tx/extract-form-ids';
import { submitSponsored } from '../src/forms/services/sponsored-submission';
import { decodeBodyPointer } from '../src/walrus/body-pointer';

const NETWORK = 'testnet' as const;
const REPO = resolve(import.meta.dir, '../../..');
const deployed = JSON.parse(
  readFileSync(resolve(REPO, 'apps/contracts/deployed.testnet.json'), 'utf-8'),
) as {
  packageId: string;
  originalPackageId: string;
  publisherAddress: string;
  sponsorTypesPackageId: string;
  sponsorConfig: { objectId: string };
};
const PKG = deployed.packageId;
const SPONSOR = deployed.publisherAddress;
const WAL_TYPE = '0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL';
const EPOCHS = 2;
const POOL_WAL = 300_000_000n; // 0.3 WAL
const POOL_SUI = 20_000_000n; // 0.02 SUI

const client = getSuiGrpcClient(NETWORK);
let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) pass++;
  else fail++;
  console.info(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function run(tx: Transaction, signers: { respondent?: Ed25519Keypair }) {
  const sender = signers.respondent?.toSuiAddress() ?? SPONSOR;
  tx.setSender(sender);
  if (signers.respondent) tx.setGasOwner(SPONSOR);
  const bytes = await tx.build({ client });
  const signatures = [signWithKeystore(SPONSOR, bytes)];
  if (signers.respondent) {
    signatures.unshift((await signers.respondent.signTransaction(bytes)).signature);
  }
  const res = await client.executeTransaction({
    transaction: bytes,
    signatures,
    include: { effects: true, objectTypes: true, events: true },
  });
  const tx2 = res.Transaction ?? res.FailedTransaction;
  if (!tx2?.effects?.status.success) {
    throw new Error(`tx failed: ${JSON.stringify(tx2?.effects?.status.error)}`);
  }
  await client.waitForTransaction({ digest: tx2.digest });
  return tx2;
}

async function poolState(poolId: string) {
  const { object } = await client.core.getObject({ objectId: poolId, include: { content: true } });
  const p = SponsorPool.parse(object.content);
  return {
    wal: BigInt(p.wal.value),
    sui: BigInt(p.sui.value),
    fees: BigInt(p.platform_fees.value),
    uploads: BigInt(p.total_uploads),
  };
}

async function balances(owner: string) {
  const [sui, wal] = await Promise.all([
    client.core.getBalance({ owner, coinType: '0x2::sui::SUI' }),
    client.core.getBalance({ owner, coinType: WAL_TYPE }),
  ]);
  return { sui: BigInt(sui.balance.balance), wal: BigInt(wal.balance.balance) };
}

async function main() {
  console.info(`Package ${PKG}\nConfig  ${deployed.sponsorConfig.objectId}\n`);

  console.info('1. Creator publishes a public form and opens a funded pool');
  const created = await run(
    buildCreateFormTx({
      packageId: PKG,
      sender: SPONSOR,
      title: 'Sponsored upload smoke test',
      schemaBytes: new TextEncoder().encode('{"version":"1.0","fields":[]}'),
      themeBytes: new Uint8Array(),
      settings: { accessMode: 0 },
    }),
    {},
  );
  const ids = await extractPublishIds(client, created.digest, deployed.originalPackageId);
  const formId = ids.formObjectId!;
  const capId = ids.formOwnerCapId!;
  const allowlistId = ids.allowlistId!;
  console.info(`  form ${formId}`);

  const poolTx = new Transaction();
  const [pool] = poolTx.add(
    createPool({
      package: PKG,
      arguments: {
        config: deployed.sponsorConfig.objectId,
        cap: capId,
        maxWalPerUpload: 200_000_000n,
        maxTipPerUpload: 10_000_000n,
        maxUploadsPerAddress: 4n,
      },
    }),
  );
  poolTx.add(
    depositWal({
      package: PKG,
      arguments: { pool, payment: coinWithBalance({ type: WAL_TYPE, balance: POOL_WAL }) },
    }),
  );
  poolTx.add(
    depositSui({
      package: PKG,
      arguments: { pool, payment: coinWithBalance({ balance: POOL_SUI }) },
    }),
  );
  poolTx.add(sharePool({ package: PKG, arguments: { pool } }));
  const poolRes = await run(poolTx, {});
  const poolId = poolRes.effects!.changedObjects.find(
    (c) =>
      c.idOperation === 'Created' &&
      poolRes.objectTypes?.[c.objectId]?.endsWith('::sponsor_pool::SponsorPool'),
  )!.objectId;
  const poolType = poolRes.objectTypes![poolId]!;
  console.info(`  pool ${poolId}`);
  check(
    'SponsorPool type is addressed by the version that introduced it',
    normalizeSuiAddress(poolType.split('::')[0]!) ===
      normalizeSuiAddress(deployed.sponsorTypesPackageId),
    poolType,
  );
  const before = await poolState(poolId);
  try {
    await exercise(formId, allowlistId, poolId, before);
  } finally {
    console.info('\n7. Cleanup: refund the pool, close the form');
    const left = await poolState(poolId);
    const refund = new Transaction();
    const wal = refund.add(
      withdrawWal({ package: PKG, arguments: { pool: poolId, cap: capId, amount: left.wal } }),
    );
    const sui = refund.add(
      withdrawSui({ package: PKG, arguments: { pool: poolId, cap: capId, amount: left.sui } }),
    );
    refund.transferObjects([wal, sui], SPONSOR);
    await run(refund, {});
    await run(buildCloseFormTx({ packageId: PKG, formObjectId: formId, capObjectId: capId }), {});
    console.info(
      `  refunded ${Number(left.wal) / 1e9} WAL + ${Number(left.sui) / 1e9} SUI; form closed`,
    );
  }
  console.info(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

async function exercise(
  formId: string,
  allowlistId: string,
  poolId: string,
  before: Awaited<ReturnType<typeof poolState>>,
) {
  console.info('\n2. Zero-balance respondent submits through submitSponsored (the UI path)');
  const respondent = Ed25519Keypair.generate();
  const who = respondent.toSuiAddress();
  const start = await balances(who);
  check('respondent starts with 0 SUI and 0 WAL', start.sui === 0n && start.wal === 0n, who);

  const { object: cfgObj } = await client.core.getObject({
    objectId: deployed.sponsorConfig.objectId,
    include: { content: true },
  });
  const cfg = SponsorConfig.parse(cfgObj.content);
  const p = SponsorPool.parse(
    (await client.core.getObject({ objectId: poolId, include: { content: true } })).object.content,
  );
  const files = [
    { identifier: '/0-f1-photo.txt', bytes: new TextEncoder().encode(`photo ${Date.now()}`) },
    { identifier: '/1-f2-resume.txt', bytes: new TextEncoder().encode(`resume ${Math.random()}`) },
  ];
  const bodyBytes = crypto.getRandomValues(new Uint8Array(2048));
  let fileUrls = new Map<string, string>();
  const digests: string[] = [];
  const steps: string[] = [];

  const result = await submitSponsored({
    suiClient: client,
    network: NETWORK,
    execute: async (tx) => {
      const r = await run(tx, { respondent });
      digests.push(r.digest);
      return { digest: r.digest };
    },
    target: {
      packageId: PKG,
      poolId,
      configId: deployed.sponsorConfig.objectId,
      formId,
      allowlistId,
    },
    pool: {
      poolId,
      formId,
      walFrost: BigInt(p.wal.value),
      suiMist: BigInt(p.sui.value),
      platformFeesFrost: BigInt(p.platform_fees.value),
      enabled: p.enabled,
      maxWalPerUpload: BigInt(p.max_wal_per_upload),
      maxTipPerUpload: BigInt(p.max_tip_per_upload),
      maxUploadsPerAddress: BigInt(p.max_uploads_per_address),
      totalUploads: BigInt(p.total_uploads),
      totalWalSpent: BigInt(p.total_wal_spent),
    },
    config: {
      configId: deployed.sponsorConfig.objectId,
      feeBps: BigInt(cfg.fee_bps),
      maxStoragePricePerUnit: BigInt(cfg.max_storage_price_per_unit),
      maxWritePricePerUnit: BigInt(cfg.max_write_price_per_unit),
    },
    owner: who,
    epochs: EPOCHS,
    files,
    encryptBody: async (urls) => {
      fileUrls = urls;
      // Stands in for Seal: storage doesn't care what the bytes are.
      return { ciphertext: bodyBytes, nonce: crypto.getRandomValues(new Uint8Array(16)) };
    },
    appendSubmit: (tx, body) => {
      buildSubmitTx({
        packageId: PKG,
        formObjectId: formId,
        allowlistObjectId: allowlistId,
        encryptedBody: body.pointer,
        fileBlobIds: [],
        nonce: body.nonce,
        share: true,
        transaction: tx,
      });
    },
    onStep: (step) => steps.push(step),
  });
  if (result.kind !== 'submitted') throw new Error(`sponsorship unavailable: ${result.reason}`);
  console.info(`  txs ${digests.join(', ')}`);
  check('steps reported in order', steps.join(',') === 'prepare,register,certify', steps.join(','));
  check(
    '2 register txs + 1 certify/submit tx (relay auth payload is input 0)',
    digests.length === 3,
  );

  const txs = await Promise.all(
    digests.map(async (digest) => {
      const r = await client.core.getTransaction({
        digest,
        include: { transaction: true, events: true, effects: true, objectTypes: true },
      });
      return r.Transaction ?? r.FailedTransaction;
    }),
  );
  check(
    'respondent is the SENDER of every transaction',
    txs.every((t) => t?.transaction?.sender === who),
  );
  check(
    'gas was paid by someone else',
    txs.every((t) => t?.transaction?.gasData.owner === SPONSOR),
  );
  const sponsoredEvents = txs
    .flatMap((t) => t?.events ?? [])
    .filter((e) => e.eventType.endsWith('::sponsor_pool::SponsoredBlobRegistered'))
    .map((e) => SponsoredBlobRegistered.parse(e.bcs));
  check('two SponsoredBlobRegistered events', sponsoredEvents.length === 2);
  check(
    'events name the respondent as uploader',
    sponsoredEvents.every((e) => normalizeSuiAddress(e.uploader) === normalizeSuiAddress(who)),
  );
  const created = (suffix: string) =>
    txs.flatMap((t) =>
      (t?.effects?.changedObjects ?? []).filter(
        (c) => c.idOperation === 'Created' && t?.objectTypes?.[c.objectId]?.endsWith(suffix),
      ),
    );
  check(
    'both blobs wrapped as SharedBlob (creator can extend them later)',
    created('::shared_blob::SharedBlob').length === 2,
  );
  const [submissionRef] = created('::submission::Submission');
  check('a Submission was created', !!submissionRef);
  const { object: subObj } = await client.core.getObject({
    objectId: submissionRef!.objectId,
    include: { content: true },
  });
  const bodyBlobId = decodeBodyPointer(
    new Uint8Array(Submission.parse(subObj.content).encrypted_body),
  );
  check('Submission points at the body blob', !!bodyBlobId);

  console.info('\n4. Read back from the aggregator');
  const agg = getWalrusAggregatorUrl(NETWORK);
  const bodyBack = new Uint8Array(
    await (await fetch(`${agg}/v1/blobs/${bodyBlobId}`)).arrayBuffer(),
  );
  check(
    'body blob round-trips byte-for-byte',
    Buffer.from(bodyBack).equals(Buffer.from(bodyBytes)),
  );
  for (const f of files) {
    const url = fileUrls.get(f.identifier);
    check(`attachment URL for ${f.identifier} was known before encryption`, !!url?.startsWith(agg));
    const back = new Uint8Array(await (await fetch(url!)).arrayBuffer());
    check(
      `attachment ${f.identifier} round-trips byte-for-byte`,
      Buffer.from(back).equals(Buffer.from(f.bytes)),
    );
  }

  console.info('\n5. Accounting');
  const after = await poolState(poolId);
  const spent = sponsoredEvents.reduce((n, e) => n + BigInt(e.wal_spent), 0n);
  const fees = sponsoredEvents.reduce((n, e) => n + BigInt(e.fee), 0n);
  const tips = sponsoredEvents.reduce((n, e) => n + BigInt(e.tip), 0n);
  check(
    'pool WAL fell by exactly storage + platform fee',
    before.wal - after.wal === spent + fees,
    `${spent} + ${fees} FROST`,
  );
  check('platform fee accrued in the pool', after.fees === fees && fees > 0n, `${fees} FROST`);
  check('pool SUI fell by exactly the relay tips', before.sui - after.sui === tips, `${tips} MIST`);
  check('pool counted 2 uploads', after.uploads === 2n);
  const end = await balances(who);
  check('respondent still holds 0 SUI and 0 WAL', end.sui === 0n && end.wal === 0n);

  console.info('\n6. Creator extends the sponsored storage by 1 epoch (the UI path)');
  let found: Awaited<ReturnType<typeof findFormBlobs>>['blobs'] = [];
  for (let i = 0; i < 20 && found.length < 2; i++) {
    found = (await findFormBlobs(client, NETWORK, formId)).blobs;
    if (found.length < 2) await new Promise((r) => setTimeout(r, 3_000));
  }
  check("discovers both SharedBlobs from the form's transactions", found.length === 2);
  const walrus = await getWalrusClient(client, NETWORK);
  const [system, state, staking] = await Promise.all([
    walrus.systemObject(),
    walrus.systemState(),
    walrus.stakingState(),
  ]);
  const plan = extensionPlan(
    {
      blobs: found,
      currentEpoch: staking.epoch,
      maxEpochsAhead: state.future_accounting.length,
      storagePricePerUnit: BigInt(state.storage_price_per_unit_size),
    },
    1,
  );
  const walBefore = (await balances(SPONSOR)).wal;
  await run(
    buildExtendSharedBlobsTx({
      walrusPackageId: system.package_id,
      systemObjectId: system.id,
      walCoinType: WAL_TYPE,
      epochs: 1,
      items: plan.items,
    }),
    {},
  );
  const walSpent = walBefore - (await balances(SPONSOR)).wal;
  const extended = (await findFormBlobs(client, NETWORK, formId)).blobs;
  check(
    'every SharedBlob now ends exactly 1 epoch later',
    extended.length === 2 &&
      extended.every(
        (b) =>
          b.endEpoch === (found.find((f) => f.sharedBlobId === b.sharedBlobId)?.endEpoch ?? -2) + 1,
      ),
  );
  check(
    'creator paid exactly the planned WAL',
    walSpent === plan.totalTopUpFrost,
    `${plan.totalTopUpFrost} FROST`,
  );
  check(
    'cost formula is exact (no WAL left stranded in the SharedBlobs)',
    extended.every((b) => b.fundsFrost === 0n),
  );

  console.info(`\n  Cost of one sponsored submission (2 blobs, ${EPOCHS} epochs):`);
  console.info(
    `    pool WAL: ${Number(spent + fees) / 1e9} (storage ${Number(spent) / 1e9} + fee ${Number(fees) / 1e9})`,
  );
  console.info(`    pool SUI: ${Number(tips) / 1e9} (relay tips)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
