'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Sync a Tabs component's active value with a URL query string param. Reading
 * + writing through the same param means direct-link sharing works:
 *
 *   /forms?tab=marketplace             → opens Marketplace tab
 *   /forms/results?formId=…&tab=manage → opens the Manage tab
 *
 * The setter swaps the param with `router.replace` so back-button behaviour
 * isn't polluted by every tab click. Other query params (e.g. `formId`) are
 * preserved.
 */
export function useTabQuery<T extends string>(
  paramKey: string,
  fallback: T,
  allowed?: ReadonlyArray<T>,
): [T, (next: T) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const raw = params.get(paramKey);
  const value = useMemo<T>(() => {
    if (!raw) return fallback;
    if (allowed && !(allowed as readonly string[]).includes(raw)) return fallback;
    return raw as T;
  }, [raw, fallback, allowed]);

  const setValue = useCallback(
    (next: T) => {
      const sp = new URLSearchParams(params.toString());
      if (next === fallback) sp.delete(paramKey);
      else sp.set(paramKey, next);
      const query = sp.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, router, pathname, paramKey, fallback],
  );

  return [value, setValue];
}
