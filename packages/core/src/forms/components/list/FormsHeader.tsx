'use client';

import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Logo } from '../../../ui/logo';
import { NetworkBadge, WalletButton } from '../../../sui/wallet-ui';
import { useCreateDraft } from '../../hooks/use-create-draft';
import { ThemeToggle } from '../editor/ThemeToggle';

/**
 * Shared header for /forms and /forms/results. New form, theme, and
 * wallet are always present so the chrome is consistent across the two
 * pages (analytics is reached via a card click; the back affordance is the
 * Forms title link).
 */
export function FormsHeader() {
  const { createAndOpen, isCreating } = useCreateDraft();
  return (
    <header className="bg-background relative z-10 border-b">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-3">
        <Link
          to="/"
          className="hover:text-foreground/80 flex shrink-0 items-center gap-2 text-lg font-semibold transition-colors sm:text-xl"
        >
          <Logo className="size-6" />
          WalForm
        </Link>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span className="hidden sm:flex">
            <NetworkBadge />
          </span>
          <ThemeToggle />
          <Button
            onClick={() => void createAndOpen()}
            disabled={isCreating}
            className="shrink-0 px-2.5 sm:px-4"
          >
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{isCreating ? 'Creating…' : 'New form'}</span>
          </Button>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
