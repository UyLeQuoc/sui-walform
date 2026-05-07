'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { BORDER_RADIUS_VALUES, DEFAULT_BORDER_RADIUS } from './form-appearance';

interface FormAppearanceContextValue {
  /** Resolved CSS length (e.g. '0rem', '0.5rem') for the form's border radius. */
  radius: string;
}

const FormAppearanceContext = createContext<FormAppearanceContextValue | null>(null);

interface FormAppearanceProviderProps {
  borderRadiusIndex: number | undefined;
  children: ReactNode;
}

export function FormAppearanceProvider({
  borderRadiusIndex,
  children,
}: FormAppearanceProviderProps) {
  const value = useMemo<FormAppearanceContextValue>(() => {
    const idx = borderRadiusIndex ?? DEFAULT_BORDER_RADIUS;
    return { radius: BORDER_RADIUS_VALUES[idx] ?? BORDER_RADIUS_VALUES[DEFAULT_BORDER_RADIUS]! };
  }, [borderRadiusIndex]);

  return <FormAppearanceContext.Provider value={value}>{children}</FormAppearanceContext.Provider>;
}

/** Returns the resolved radius as a CSS length, or `undefined` outside a form area. */
export function useFormRadius(): string | undefined {
  return useContext(FormAppearanceContext)?.radius;
}
