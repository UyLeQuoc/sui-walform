import { coinWithBalance, Transaction } from '@mysten/sui/transactions';
import {
  createPool,
  depositSui,
  depositWal,
  setEnabled,
  setLimits,
  sharePool,
  withdrawSui,
  withdrawWal,
} from '../gen/walform/sponsor_pool';
import type { RawTransactionArgument } from '../gen/utils/index';
import { nthResult } from './nth-result';

export interface SponsorPoolLimits {
  /** Max WAL (FROST) one blob registration may borrow. */
  maxWalPerUpload: bigint;
  /** Max SUI (MIST) one upload may draw for the relay tip. */
  maxTipPerUpload: bigint;
  /** Sponsored uploads per address; 0 = unlimited. */
  maxUploadsPerAddress: bigint;
}

export interface SponsorPoolFunding {
  /** FROST to deposit (0 / omitted = none). */
  wal?: bigint;
  /** MIST to deposit (0 / omitted = none). */
  sui?: bigint;
  walCoinType: string;
  /**
   * Where the SUI comes from. `owned` (default) is the only option when a gas
   * sponsor pays — the gas coin isn't the sender's. `gas` when the wallet pays
   * its own gas: `owned` would consume every SUI coin and leave none for gas.
   * Build one of each and pass the `gas` one as `walletTransaction`.
   */
  suiFrom?: 'owned' | 'gas';
}

/**
 * Opens a form's pool, optionally funds it, and shares it — one PTB, since
 * `create_pool` returns the pool by value.
 */
export function buildCreateSponsorPoolTx(input: {
  packageId: string;
  configId: string;
  formOwnerCapId: string;
  limits: SponsorPoolLimits;
  funding?: SponsorPoolFunding;
}): Transaction {
  const tx = new Transaction();
  const created = tx.add(
    createPool({
      package: input.packageId,
      arguments: {
        config: input.configId,
        cap: input.formOwnerCapId,
        maxWalPerUpload: input.limits.maxWalPerUpload,
        maxTipPerUpload: input.limits.maxTipPerUpload,
        maxUploadsPerAddress: input.limits.maxUploadsPerAddress,
      },
    }),
  );
  const pool = nthResult(created, 0);
  if (input.funding) addDeposits(tx, input.packageId, pool, input.funding);
  tx.add(sharePool({ package: input.packageId, arguments: { pool } }));
  return tx;
}

/** Anyone can fund a pool — the creator, a co-sponsor, or a grant. */
export function buildFundSponsorPoolTx(input: {
  packageId: string;
  poolId: string;
  funding: SponsorPoolFunding;
}): Transaction {
  const tx = new Transaction();
  addDeposits(tx, input.packageId, input.poolId, input.funding);
  return tx;
}

export function buildWithdrawSponsorPoolTx(input: {
  packageId: string;
  poolId: string;
  formOwnerCapId: string;
  recipient: string;
  wal?: bigint;
  sui?: bigint;
}): Transaction {
  const tx = new Transaction();
  const out = [];
  if (input.wal && input.wal > 0n) {
    out.push(
      tx.add(
        withdrawWal({
          package: input.packageId,
          arguments: { pool: input.poolId, cap: input.formOwnerCapId, amount: input.wal },
        }),
      ),
    );
  }
  if (input.sui && input.sui > 0n) {
    out.push(
      tx.add(
        withdrawSui({
          package: input.packageId,
          arguments: { pool: input.poolId, cap: input.formOwnerCapId, amount: input.sui },
        }),
      ),
    );
  }
  if (out.length === 0) throw new Error('Nothing to withdraw.');
  tx.transferObjects(out, input.recipient);
  return tx;
}

export function buildUpdateSponsorPoolTx(input: {
  packageId: string;
  poolId: string;
  formOwnerCapId: string;
  limits?: SponsorPoolLimits;
  enabled?: boolean;
}): Transaction {
  const tx = new Transaction();
  if (input.limits) {
    tx.add(
      setLimits({
        package: input.packageId,
        arguments: {
          pool: input.poolId,
          cap: input.formOwnerCapId,
          maxWalPerUpload: input.limits.maxWalPerUpload,
          maxTipPerUpload: input.limits.maxTipPerUpload,
          maxUploadsPerAddress: input.limits.maxUploadsPerAddress,
        },
      }),
    );
  }
  if (input.enabled !== undefined) {
    tx.add(
      setEnabled({
        package: input.packageId,
        arguments: { pool: input.poolId, cap: input.formOwnerCapId, enabled: input.enabled },
      }),
    );
  }
  return tx;
}

function addDeposits(
  tx: Transaction,
  packageId: string,
  pool: RawTransactionArgument<string>,
  funding: SponsorPoolFunding,
): void {
  if (funding.wal && funding.wal > 0n) {
    tx.add(
      depositWal({
        package: packageId,
        arguments: {
          pool,
          payment: coinWithBalance({ type: funding.walCoinType, balance: funding.wal }),
        },
      }),
    );
  }
  if (funding.sui && funding.sui > 0n) {
    tx.add(
      depositSui({
        package: packageId,
        arguments: {
          pool,
          payment: coinWithBalance({ balance: funding.sui, useGasCoin: funding.suiFrom === 'gas' }),
        },
      }),
    );
  }
}
