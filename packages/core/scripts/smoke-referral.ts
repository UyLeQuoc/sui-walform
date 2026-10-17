/**
 * Testnet e2e for referral links: the real tx builders and discovery against
 * the upgraded package. Needs `referralTypesPackageId` in
 * apps/contracts/deployed.testnet.json (run `contracts:upgrade`, then
 * `contracts:referral-config`). The deployer signs as creator and pays every
 * respondent's gas; respondents are throwaway keypairs. Cost: a few
 * hundredths of a testnet SUI.
 *
 *   bun run packages/core/scripts/smoke-referral.ts
 *
 * The paid-form path (`referral::submit_paid_and_share`) is covered by the
 * Move unit tests.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { normalizeSuiAddress } from '@mysten/sui/utils';

import { signWithKeystore } from '../../../apps/contracts/scripts/lib/deployments';
import { referralCountFor, referralLeaderboard } from '../src/forms/lib/referrals';
import { collectFormReferrals } from '../src/sui/graphql/referrals';
import { getSuiGrpcClient } from '../src/sui/grpc/client';
import { buildCloseFormTx } from '../src/sui/tx/close-form';
import { buildCreateFormTx } from '../src/sui/tx/create-form';
import { extractPublishIds } from '../src/sui/tx/extract-form-ids';
import { extractSubmissionId } from '../src/sui/tx/extract-submission-id';
import { buildSubmitTx } from '../src/sui/tx/submit';
import type { ReferralRecord } from '../src/types';

const NETWORK = 'testnet' as const;
const REPO = resolve(import.meta.dir, '../../..');
const deployed = JSON.parse(
  readFileSync(resolve(REPO, 'apps/contracts/deployed.testnet.json'), 'utf-8'),
) as {
  packageId: string;
  originalPackageId: string;
  publisherAddress: string;
  referralTypesPackageId?: string;
};
const PKG = deployed.packageId;
const CREATOR = deployed.publisherAddress;
const TYPES = deployed.referralTypesPackageId;

const client = getSuiGrpcClient(NETWORK);
let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) pass++;
  else fail++;
  console.info(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` - ${detail}` : ''}`);
}

/**
 * Executes `tx` as `respondent` (gas paid by the creator) or as the creator.
 * Never throws on abort: an abort caught while building (gas estimation
 * simulates the tx) comes back as `ok: false` without anything being sent.
 */
async function exec(tx: Transaction, respondent?: Ed25519Keypair) {
  const sender = respondent?.toSuiAddress() ?? CREATOR;
  tx.setSender(sender);
  if (respondent) tx.setGasOwner(CREATOR);
  let bytes: Uint8Array;
  try {
    bytes = await tx.build({ client });
  } catch (err) {
    return { digest: '(not sent)', ok: false, error: String(err) };
  }
  const signatures = [signWithKeystore(CREATOR, bytes)];
  if (respondent) signatures.unshift((await respondent.signTransaction(bytes)).signature);
  const res = await client.executeTransaction({
    transaction: bytes,
    signatures,
    include: { effects: true },
  });
  const done = res.Transaction ?? res.FailedTransaction;
  if (!done) throw new Error('no transaction in response');
  await client.waitForTransaction({ digest: done.digest });
  return {
    digest: done.digest,
    ok: !!done.effects?.status.success,
    error: JSON.stringify(done.effects?.status.error ?? null),
  };
}

async function run(tx: Transaction, respondent?: Ed25519Keypair) {
  const r = await exec(tx, respondent);
  if (!r.ok) throw new Error(`tx ${r.digest} failed: ${r.error}`);
  return r.digest;
}

async function createForm(title: string) {
  const digest = await run(
    buildCreateFormTx({
      packageId: PKG,
      sender: CREATOR,
      title,
      schemaBytes: new TextEncoder().encode('{"version":"1.0","fields":[]}'),
      themeBytes: new Uint8Array(),
      settings: { accessMode: 0 },
    }),
  );
  const ids = await extractPublishIds(client, digest, deployed.originalPackageId);
  if (!ids.formObjectId || !ids.formOwnerCapId || !ids.allowlistId) {
    throw new Error(`create ${digest}: missing form / cap / allowlist`);
  }
  return { formId: ids.formObjectId, capId: ids.formOwnerCapId, allowlistId: ids.allowlistId };
}

function submitTx(
  form: { formId: string; allowlistId: string },
  referrerSubmissionId?: string,
): Transaction {
  return buildSubmitTx({
    packageId: PKG,
    formObjectId: form.formId,
    allowlistObjectId: form.allowlistId,
    // The contract never reads the body; real clients store a Seal/Walrus pointer here.
    encryptedBody: crypto.getRandomValues(new Uint8Array(64)),
    fileBlobIds: [],
    nonce: crypto.getRandomValues(new Uint8Array(16)),
    referrerSubmissionId,
  });
}

async function referralsOf(formId: string, expected: number): Promise<ReferralRecord[]> {
  if (!TYPES) return [];
  let records: ReferralRecord[] = [];
  // GraphQL indexes a few seconds behind execution.
  for (let i = 0; i < 20 && records.length < expected; i++) {
    records = await collectFormReferrals({
      network: NETWORK,
      referralTypesPackageId: TYPES,
      formId,
    });
    if (records.length < expected) await new Promise((r) => setTimeout(r, 3_000));
  }
  return records;
}

async function main() {
  if (!TYPES) {
    throw new Error(
      'deployed.testnet.json has no referralTypesPackageId — run `SUI_NETWORK=testnet bun run contracts:upgrade` then `SUI_NETWORK=testnet bun run contracts:referral-config`.',
    );
  }
  console.info(`Package ${PKG}\nReferral types ${TYPES}\n`);

  console.info('1. Creator publishes a form; respondent A submits normally');
  const form = await createForm('Referral smoke test');
  const other = await createForm('Referral smoke test (other form)');
  console.info(`  form ${form.formId}`);
  const a = new Ed25519Keypair();
  const b = new Ed25519Keypair();
  const c = new Ed25519Keypair();
  const aDigest = await run(submitTx(form), a);
  const aSubmission = await extractSubmissionId(client, aDigest, deployed.originalPackageId);
  check("A's Submission id is read back from the tx", !!aSubmission, aSubmission ?? '');
  if (!aSubmission) throw new Error('cannot continue without A’s Submission');

  try {
    console.info("\n2. B and C submit through A's link");
    const bDigest = await run(submitTx(form, aSubmission), b);
    await run(submitTx(form, aSubmission), c);
    const bSubmission = await extractSubmissionId(client, bDigest, deployed.originalPackageId);
    check(
      'a referral submit still creates a normal Submission',
      !!bSubmission && bSubmission !== aSubmission,
    );

    console.info('\n3. Discovery and leaderboard');
    const records = await referralsOf(form.formId, 2);
    const aAddr = normalizeSuiAddress(a.toSuiAddress());
    check('two ReferralRecorded events on the form', records.length === 2, `${records.length}`);
    check(
      'both credit A, via A’s Submission',
      records.every((r) => r.referrer === aAddr && r.referrerSubmissionId === aSubmission),
    );
    check(
      'the referred submitters are B and C',
      new Set(records.map((r) => r.submitter)).size === 2 &&
        records.some((r) => r.submitter === normalizeSuiAddress(b.toSuiAddress())) &&
        records.some((r) => r.submitter === normalizeSuiAddress(c.toSuiAddress())),
    );
    check(
      "B's record points at B's Submission",
      records.some((r) => r.submissionId === bSubmission),
    );
    const board = referralLeaderboard(records);
    check(
      'leaderboard: A first with 2',
      board.length === 1 && board[0]?.referrer === aAddr && board[0]?.people === 2,
    );
    check("A's own count is 2", referralCountFor(records, a.toSuiAddress()) === 2);

    console.info('\n4. The contract rejects bad referrals');
    const self = await exec(submitTx(form, aSubmission), a);
    check(
      'A using their own link aborts (E_SELF_REFERRAL = 2)',
      !self.ok && /referral/.test(self.error) && /\b2\b/.test(self.error),
    );
    const wrong = await exec(submitTx(other, aSubmission), b);
    check(
      'a referrer from another form aborts (E_REFERRER_WRONG_FORM = 1)',
      !wrong.ok && /referral/.test(wrong.error) && /\b1\b/.test(wrong.error),
    );
    const after = await referralsOf(form.formId, 2);
    check('rejected attempts recorded nothing', after.length === 2);
  } finally {
    console.info('\n5. Cleanup');
    await run(
      buildCloseFormTx({ packageId: PKG, formObjectId: form.formId, capObjectId: form.capId }),
    );
    await run(
      buildCloseFormTx({ packageId: PKG, formObjectId: other.formId, capObjectId: other.capId }),
    );
    console.info('  both forms closed');
  }

  console.info(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
