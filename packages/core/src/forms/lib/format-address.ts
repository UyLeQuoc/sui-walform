/**
 * Truncate a Sui address for display: `0x123abc…7890` (head + tail).
 * Returns the input unchanged when it's already shorter than the truncation
 * would render, so very short addresses (rare) don't get padded with ellipses.
 */
export function shortAddr(addr: string, head = 6, tail = 4): string {
  if (!addr) return '—';
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}
