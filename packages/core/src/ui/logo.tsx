'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@teispace/next-themes';
import { cn } from '../lib/utils';

export type LogoVariant = 'auto' | 'primary' | 'white' | 'black';

interface LogoProps {
  /**
   * `auto` flips between white (dark) and black (light) via the active theme.
   * `primary` always renders the brand-blue mark — use on neutral surfaces
   * where you want the colored variant. `white` / `black` force a fixed asset.
   */
  variant?: LogoVariant;
  /** Tailwind classes applied to the `<img>` — control size via `size-*` here. */
  className?: string;
  /** When true, renders the "WalForm" wordmark next to the mark. */
  withWordmark?: boolean;
  /** Wordmark text. Override only when embedding under a sub-brand. */
  wordmark?: string;
  /** Tailwind classes for the wordmark span. */
  wordmarkClassName?: string;
}

const SRC: Record<Exclude<LogoVariant, 'auto'>, string> = {
  primary: '/images/logo-primary.svg',
  white: '/images/logo-white.svg',
  black: '/images/logo-black.svg',
};

export function Logo({
  variant = 'auto',
  className,
  withWordmark = false,
  wordmark = 'WalForm',
  wordmarkClassName,
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const resolved: Exclude<LogoVariant, 'auto'> =
    variant === 'auto' ? (mounted && resolvedTheme === 'dark' ? 'white' : 'black') : variant;

  return (
    <span className="inline-flex items-center gap-2">
      <img src={SRC[resolved]} alt="WalForm" className={cn('size-7', className)} />
      {withWordmark && (
        <span className={cn('text-base font-semibold tracking-tight', wordmarkClassName)}>
          {wordmark}
        </span>
      )}
    </span>
  );
}
