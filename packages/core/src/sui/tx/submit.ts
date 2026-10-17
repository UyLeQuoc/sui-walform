import { Transaction } from '@mysten/sui/transactions';
import { submitAndShare as referralSubmitAndShare } from '../gen/walform/referral';
import { submit, submitAndShare, submitPaid, submitPaidAndShare } from '../gen/walform/submission';

export interface BuildSubmitTxInput {
  packageId: string;
  formObjectId: string;
  /** Allowlist object id (dummy allowed for ACCESS_PUBLIC forms). */
  allowlistObjectId: string;
  encryptedBody: Uint8Array;
  fileBlobIds: Uint8Array[];
  nonce: Uint8Array;
  /** Share the Submission as a shared object (default: true). */
  share?: boolean;
  /**
   * Submission whose referral link brought this respondent. Goes through
   * `referral::submit_and_share`, which always shares.
   */
  referrerSubmissionId?: string;
  /** Append to this transaction instead of starting a new one. */
  transaction?: Transaction;
}

export function buildSubmitTx(input: BuildSubmitTxInput): Transaction {
  const tx = input.transaction ?? new Transaction();
  if (input.referrerSubmissionId) {
    tx.add(
      referralSubmitAndShare({
        package: input.packageId,
        arguments: {
          form: input.formObjectId,
          allowlist: input.allowlistObjectId,
          referrer: input.referrerSubmissionId,
          encryptedBody: Array.from(input.encryptedBody),
          fileBlobIds: input.fileBlobIds.map((b) => Array.from(b)),
          nonce: Array.from(input.nonce),
        },
      }),
    );
    return tx;
  }
  const share = input.share ?? true;
  const fn = share ? submitAndShare : submit;
  tx.add(
    fn({
      package: input.packageId,
      arguments: {
        form: input.formObjectId,
        allowlist: input.allowlistObjectId,
        encryptedBody: Array.from(input.encryptedBody),
        fileBlobIds: input.fileBlobIds.map((b) => Array.from(b)),
        nonce: Array.from(input.nonce),
      },
    }),
  );
  return tx;
}

export interface BuildSubmitPaidTxInput {
  packageId: string;
  formObjectId: string;
  treasuryObjectId: string;
  feeCoinId: string;
  encryptedBody: Uint8Array;
  fileBlobIds: Uint8Array[];
  nonce: Uint8Array;
  share?: boolean;
}

export function buildSubmitPaidTx(input: BuildSubmitPaidTxInput): Transaction {
  const tx = new Transaction();
  const share = input.share ?? true;
  const fn = share ? submitPaidAndShare : submitPaid;
  tx.add(
    fn({
      package: input.packageId,
      arguments: {
        form: input.formObjectId,
        treasury: input.treasuryObjectId,
        feeCoin: input.feeCoinId,
        encryptedBody: Array.from(input.encryptedBody),
        fileBlobIds: input.fileBlobIds.map((b) => Array.from(b)),
        nonce: Array.from(input.nonce),
      },
    }),
  );
  return tx;
}
