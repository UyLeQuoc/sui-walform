/**
 * Convert SUI (decimal) → MIST (raw u64 base units). 1 SUI = 1e9 MIST.
 *
 * Negative or non-finite inputs collapse to 0n so callers don't have to
 * sanitize separately. Rounds to nearest MIST (i.e. nearest 1e-9 SUI).
 */
export function suiToMist(sui: number): bigint {
  if (!Number.isFinite(sui) || sui < 0) return 0n;
  return BigInt(Math.round(sui * 1_000_000_000));
}

/**
 * Format a MIST amount as a SUI string with trailing zeros trimmed for
 * readability (0.10 → 0.1, 0.123450000 → 0.12345). Returns '0' for zero.
 */
export function formatSui(mist: bigint): string {
  if (mist === 0n) return '0';
  const whole = mist / 1_000_000_000n;
  const frac = mist % 1_000_000_000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fracStr}`;
}

/** WAL has the same 9 decimals as SUI (1 WAL = 1e9 FROST). */
export function walToFrost(wal: number): bigint {
  return suiToMist(wal);
}

export function formatWal(frost: bigint): string {
  return formatSui(frost);
}

/**
 * Compact display of a 9-decimal amount: at most `maxDecimals` decimals,
 * trailing zeros trimmed (0.992792098 → 0.9928). Pair it with `formatSui` /
 * `formatWal` in a title when the exact value matters.
 */
export function formatAmountShort(raw: bigint, maxDecimals = 4): string {
  if (raw === 0n) return '0';
  const unit = 10n ** BigInt(9 - maxDecimals);
  const rounded = (raw + unit / 2n) / unit;
  if (rounded === 0n) return `<${(1 / 10 ** maxDecimals).toFixed(maxDecimals)}`;
  const scale = 10n ** BigInt(maxDecimals);
  const frac = (rounded % scale).toString().padStart(maxDecimals, '0').replace(/0+$/, '');
  return frac ? `${rounded / scale}.${frac}` : (rounded / scale).toString();
}
