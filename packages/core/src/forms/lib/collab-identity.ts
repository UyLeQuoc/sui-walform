// Wallet-derived presence identity: a stable color from the address hash and a
// truncated label. No usernames to manage.

export function colorForAddress(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 72% 52%)`;
}

export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function peerLabel(address: string, name?: string): string {
  return name && name.length > 0 ? name : truncateAddress(address);
}

export function peerInitials(address: string, name?: string): string {
  if (name && name.length > 0) return name.slice(0, 2).toUpperCase();
  return address.replace(/^0x/, '').slice(0, 2).toUpperCase();
}

const ANON_STORAGE_KEY = 'walform-anon-identity';
const ANON_ANIMALS = [
  'Otter',
  'Fox',
  'Panda',
  'Koala',
  'Robin',
  'Lynx',
  'Heron',
  'Tapir',
  'Ibis',
  'Wren',
];

export interface AnonymousIdentity {
  address: string;
  name: string;
  color: string;
}

/**
 * A stable per-browser identity for collaborators with no connected wallet.
 * Generated once and cached in localStorage so the same person keeps the same
 * name + color across reloads. `address` carries a synthetic `anon:<id>` so the
 * presence plumbing (which keys on `address`) works unchanged; `name` drives
 * the visible label. Falls back gracefully when storage is blocked.
 */
export function getAnonymousIdentity(): AnonymousIdentity {
  const create = (): AnonymousIdentity => {
    const seed = Math.random().toString(36).slice(2);
    const animal = ANON_ANIMALS[Math.floor(Math.random() * ANON_ANIMALS.length)] ?? 'Guest';
    return { address: `anon:${seed}`, name: `Anonymous ${animal}`, color: colorForAddress(seed) };
  };
  if (typeof window === 'undefined') return create();
  try {
    const cached = window.localStorage.getItem(ANON_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as Partial<AnonymousIdentity>;
      if (parsed.address && parsed.name && parsed.color) return parsed as AnonymousIdentity;
    }
  } catch {
    // corrupt or blocked storage — fall through to a fresh identity
  }
  const identity = create();
  try {
    window.localStorage.setItem(ANON_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // private mode / quota — identity is still usable in-memory this session
  }
  return identity;
}
