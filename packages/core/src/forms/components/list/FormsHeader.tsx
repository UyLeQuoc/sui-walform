'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Logo } from '../../../ui/logo';
import { WalletButton } from '../../../sui/wallet-ui';
import { useCreateDraft } from '../../hooks/use-create-draft';
import { ThemeToggle } from '../editor/ThemeToggle';

/**
 * Shared header for /forms and /forms/[id]/results. New form, theme, and
 * wallet are always present so the chrome is consistent across the two
 * pages (analytics is reached via a card click; the back affordance is the
 * Forms title link).
 */
export function FormsHeader() {
  const { createAndOpen, isCreating } = useCreateDraft();
  return (
    <header className="bg-background relative z-10 border-b">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
        <Link
          href="/forms"
          className="hover:text-foreground/80 flex items-center gap-2 text-xl font-semibold transition-colors"
        >
          <Logo className="size-6" />
          Forms
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button onClick={() => void createAndOpen()} disabled={isCreating}>
            <Plus className="mr-1.5 h-4 w-4" />
            {isCreating ? 'Creating…' : 'New form'}
          </Button>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
