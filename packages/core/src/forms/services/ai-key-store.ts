'use client';

const STORAGE_KEY = 'walform:openrouter-key';

/**
 * Persisted BYOK store for the AI generate feature. localStorage keeps it
 * trivially simple — survives reload, never leaves the device, no IDB
 * ceremony for a single string.
 *
 * SSR safety: every getter checks `typeof window` so server-rendered Next.js
 * pages don't blow up. Returns null on the server.
 */

export function getOpenRouterKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setOpenRouterKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (key.trim()) {
      window.localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage can throw in private mode / over-quota — caller's UI just
    // won't persist. Silent failure is fine.
  }
}

export function clearOpenRouterKey(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
