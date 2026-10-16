import type { ClientWithCoreApi } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import {
  getWalrusAggregatorUrl,
  getWalrusUploadRelayHost,
  type WalformNetwork,
} from '../../sui/env-network';
import { encodeBodyPointer } from '../../walrus/body-pointer';
import {
  addCertifyAndShare,
  fetchRelayTip,
  prepareBlob,
  prepareQuilt,
  registerSponsoredBlobs,
  sponsorshipBlocker,
  type SponsorTarget,
} from '../../walrus/sponsored-register';
import { getWalrusClient } from '../../walrus/walrus-client';
import type { SponsorConfigState, SponsorPoolState } from '../../types';

export type SponsoredStep = 'prepare' | 'register' | 'certify';

export interface SponsoredSubmissionArgs {
  suiClient: ClientWithCoreApi;
  network: WalformNetwork;
  /** Signs as the respondent and executes (gas may be sponsored). */
  execute: (tx: Transaction) => Promise<{ digest: string }>;
  target: SponsorTarget;
  pool: SponsorPoolState;
  config: SponsorConfigState;
  owner: string;
  epochs: number;
  files: { identifier: string; bytes: Uint8Array }[];
  /** Serializes + Seal-encrypts the response once attachment URLs are known. */
  encryptBody: (
    fileUrls: Map<string, string>,
  ) => Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }>;
  /** Appends the `submission::submit*` call to the final transaction. */
  appendSubmit: (tx: Transaction, body: { pointer: Uint8Array; nonce: Uint8Array }) => void;
  onStep?: (step: SponsoredStep, detail?: string) => void;
}

export type SponsoredSubmissionResult =
  | { kind: 'submitted'; digest: string }
  /** Nothing was spent — the caller may fall back to wallet-paid uploads. */
  | { kind: 'unavailable'; reason: string };

const WALLET_REJECTION = /reject|denied|cancel/i;

/**
 * Submits a response whose Walrus storage is paid by the form's sponsor pool
 * while the respondent stays the sender of every Walrus transaction:
 * attachments (as one quilt) and the encrypted body are each registered in
 * their own sponsored tx, and the last one is certified in the same tx as the
 * submission.
 */
export async function submitSponsored(
  args: SponsoredSubmissionArgs,
): Promise<SponsoredSubmissionResult> {
  const walrus = await getWalrusClient(args.suiClient, args.network);
  args.onStep?.('prepare');
  const relayTip = await fetchRelayTip(getWalrusUploadRelayHost(args.network));

  const quilt = args.files.length > 0 ? await prepareQuilt(walrus, args.files) : null;
  const aggregator = getWalrusAggregatorUrl(args.network);
  const fileUrls = new Map(
    [...(quilt?.patchIds ?? [])].map(([identifier, patchId]) => [
      identifier,
      `${aggregator}/v1/blobs/by-quilt-patch-id/${patchId}`,
    ]),
  );
  const { ciphertext, nonce } = await args.encryptBody(fileUrls);
  const body = await prepareBlob(walrus, ciphertext);
  const blobs = quilt ? [quilt.blob, body] : [body];

  const blocker = await sponsorshipBlocker(
    walrus,
    args.pool,
    args.config,
    blobs,
    args.epochs,
    relayTip,
  );
  if (blocker) return { kind: 'unavailable', reason: blocker };

  args.onStep?.('register', blobs.length > 1 ? `${blobs.length} storage transactions` : undefined);
  let executed = 0;
  let registered;
  try {
    registered = await registerSponsoredBlobs(
      {
        walrus,
        suiClient: args.suiClient,
        execute: async (tx) => {
          const res = await args.execute(tx);
          executed++;
          return res;
        },
      },
      args.target,
      blobs,
      { epochs: args.epochs, owner: args.owner, relayTip },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (executed === 0 && !WALLET_REJECTION.test(msg)) {
      return { kind: 'unavailable', reason: msg };
    }
    throw err;
  }

  args.onStep?.('certify');
  const tx = new Transaction();
  await addCertifyAndShare(tx, walrus, registered);
  args.appendSubmit(tx, { pointer: encodeBodyPointer(body.blobId), nonce });
  const { digest } = await args.execute(tx);
  return { kind: 'submitted', digest };
}
