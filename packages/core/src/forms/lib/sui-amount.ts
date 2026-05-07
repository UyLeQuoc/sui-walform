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
