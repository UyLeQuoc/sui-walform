/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `true` once the component has mounted on the client.
 *
 * Useful for SSR-sensitive UI that must be hidden during the first
 * server render to avoid a hydration mismatch (e.g. theme toggles, or
 * any code that reads from `window` / `localStorage` / IndexedDB).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
