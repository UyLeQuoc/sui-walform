'use client';

import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/utils';
import { useWalletAddress } from './useWalletAddress';
import { Button } from '../../ui';
import { ChevronRight } from 'lucide-react';

export const WalletChip = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  function WalletChip({ className, ...props }, ref) {
    const { short } = useWalletAddress();
    if (!short) return null;
    return (
      <Button
        ref={ref}
        type="button"
        variant="outline"
        className={cn(
          'bg-background hover:bg-muted bordertransition-colors inline-flex items-center gap-2',
          className,
        )}
        {...props}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-muted-foreground font-mono">{short}</span>
        <ChevronRight className="text-muted-foreground h-4 w-4" />
      </Button>
    );
  },
);
