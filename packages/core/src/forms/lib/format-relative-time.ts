/**
 * Render a unix-ms timestamp as a relative-to-now string. Coarsens above
 * 30 days into a locale date so old timestamps don't drift to "300d ago".
 */
export function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}
