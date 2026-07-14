'use client';

import type { ReactNode } from 'react';
import { Send, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/utils';
import { Logo } from '../../../ui/logo';
import { NetworkBadge, WalletButton } from '../../../sui/wallet-ui';
import { ThemeToggle } from '../editor/ThemeToggle';

interface CenteredMessageProps {
  title: string;
  description: string;
  /** Icon shown in the tinted circle. Defaults to a paper-plane. */
  icon?: LucideIcon;
  /** `error` tints the circle red — use for failures, not for expected
   * terminal states like "closed" or "limit reached". */
  tone?: 'default' | 'error';
  /** Optional CTA(s) rendered below the description (e.g. a Retry button). */
  action?: ReactNode;
}

/**
 * Full-screen "form unavailable" card used by the submit page for terminal
 * states: form not found, closed, schema unparseable, etc.
 *
 * Carries the SAME header as the live submit page (logo + network switcher +
 * wallet) so a user who landed here because they're on the wrong network can
 * flip testnet ↔ mainnet right away — switching re-resolves the form in place,
 * and the header doesn't jump when it loads.
 */
export function CenteredMessage({
  title,
  description,
  icon: Icon = Send,
  tone = 'default',
  action,
}: CenteredMessageProps) {
  return (
    <div className="bg-secondary/40 flex min-h-screen flex-col px-4 py-6">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2">
        <Link to="/" aria-label="WalForm home" className="flex items-center gap-2">
          <Logo className="size-5" withWordmark />
        </Link>
        <div className="flex items-center gap-2">
          <NetworkBadge />
          <ThemeToggle />
          <WalletButton />
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center py-10">
        <div className="bg-card flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border p-8 text-center shadow-xl">
          <div
            className={cn(
              'rounded-full p-3.5',
              tone === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-muted-foreground text-sm leading-relaxed [text-wrap:balance]">
              {description}
            </p>
          </div>
          {action && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{action}</div>
          )}
        </div>
      </div>
    </div>
  );
}
