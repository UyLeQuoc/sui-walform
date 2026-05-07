'use client';

import { Signer } from '@mysten/sui/cryptography';
import type { Transaction } from '@mysten/sui/transactions';
import type { ClientWithCoreApi } from '@mysten/sui/client';

/**
 * Adapter so the Walrus SDK (which expects a `Signer` from `@mysten/sui`)
 * can drive a dApp Kit wallet. Walrus's `WalrusClient.writeFiles` /
 * `writeBlob` only call `signer.toSuiAddress()` and
 * `signer.signAndExecuteTransaction({transaction, client})` — the abstract
 * `sign` / `getKeyScheme` / `getPublicKey` methods aren't touched, so we
 * implement them defensively (throw if called).
 *
 * Constructed once per session via `useWalrusWalletSigner()` (browser hook),
 * passed into `walrus.writeFiles({ signer })`.
 */
export class WalrusWalletSigner extends Signer {
  constructor(
    private readonly address: string,
    private readonly signAndExecute: (args: {
      transaction: Transaction;
      chain?: `sui:${string}`;
    }) => Promise<{ digest: string; rawEffects?: unknown }>,
  ) {
    super();
  }

  toSuiAddress(): string {
    return this.address;
  }

  // Walrus SDK calls this on the registration tx — that's the only path we
  // need to support. `transaction` is a fully-built Transaction; we hand
  // it straight to dApp Kit which signs + broadcasts in one step.
  async signAndExecuteTransaction({
    transaction,
    client,
  }: {
    transaction: Transaction;
    client: ClientWithCoreApi;
  }) {
    const result = await this.signAndExecute({ transaction });
    // The SDK consumes `result.transaction` + `result.effects`. The wallet
    // typically broadcasts via its own RPC node, which may be ahead of our
    // configured fullnode — querying us immediately can fail with "Could
    // not find the referenced transaction". Poll with backoff, swallowing
    // not-found until propagation catches up. Cap at ~30s.
    const block = await waitForTxIndexed(client, result.digest);
    return block as ReturnType<Signer['signAndExecuteTransaction']> extends Promise<infer R>
      ? R
      : never;
  }

  // The remaining abstract methods aren't used by Walrus's writeFiles flow.
  // Throw so misuse surfaces immediately instead of producing bad sigs.
  async sign(): Promise<Uint8Array<ArrayBuffer>> {
    throw new Error(
      'WalrusWalletSigner does not support raw `sign(bytes)` — wallets do not expose private keys.',
    );
  }

  getKeyScheme(): never {
    throw new Error(
      'WalrusWalletSigner does not expose key scheme — use signAndExecuteTransaction instead.',
    );
  }

  getPublicKey(): never {
    throw new Error('WalrusWalletSigner does not expose public key — use toSuiAddress() instead.');
  }
}

/**
 * Poll `client.core.waitForTransaction` until the tx is indexed by our node,
 * absorbing "Could not find the referenced transaction" errors as retryable.
 * Then, since the upload-relay independently queries chain to verify the tip
 * payment and may use a different RPC node, also wait on Mysten's public
 * testnet fullnode — most relays trust that endpoint and will see the tx
 * shortly after it indexes there.
 */
async function waitForTxIndexed(
  client: ClientWithCoreApi,
  digest: string,
  opts: { timeoutMs?: number; pollSchedule?: number[] } = {},
): Promise<unknown> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const schedule = opts.pollSchedule ?? [250, 500, 750, 1000, 1500, 2000, 2500, 3000];

  // Wait on our SuiClient first — required for the SDK's subsequent calls
  // that read effects from this same client.
  const block = await pollUntilFound(
    () =>
      client.core.waitForTransaction({
        digest,
        include: { transaction: true, effects: true },
      }),
    digest,
    timeoutMs,
    schedule,
    'fullnode',
  );

  // Then make sure Mysten's public testnet RPC sees it too. Walrus
  // upload-relays typically query a public RPC to verify the tip-payment tx
  // before accepting the upload — if that RPC lags behind ours, the relay
  // returns "Could not find the referenced transaction".
  await pollUntilFound(() => verifyOnPublicRpc(digest), digest, timeoutMs, schedule, 'public RPC');

  return block;
}

async function pollUntilFound<T>(
  fn: () => Promise<T>,
  digest: string,
  timeoutMs: number,
  schedule: number[],
  label: string,
): Promise<T> {
  const start = Date.now();
  let attempt = 0;
  let lastErr: unknown = null;
  while (Date.now() - start < timeoutMs) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable =
        msg.includes('Could not find the referenced transaction') ||
        msg.includes('not found') ||
        msg.includes('TransactionNotFound');
      if (!retryable) throw err;
      const delay = schedule[Math.min(attempt, schedule.length - 1)]!;
      attempt += 1;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(
    `Tx ${digest} did not propagate to ${label} within ${timeoutMs}ms; last error: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

async function verifyOnPublicRpc(digest: string): Promise<void> {
  const res = await fetch('https://fullnode.testnet.sui.io', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sui_getTransactionBlock',
      params: [digest, { showEffects: false }],
    }),
  });
  const j = (await res.json()) as { error?: { message?: string }; result?: unknown };
  if (j.error) {
    // Surface the full message so the retry filter in pollUntilFound matches.
    throw new Error(j.error.message ?? 'public RPC error');
  }
  if (!j.result) throw new Error('not found on public RPC');
}
