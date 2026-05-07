'use client';

import { Globe } from 'lucide-react';

/**
 * Surfaced when `usePrefillFromHash` populated the form from a Walrus Site
 * handoff. Tells the submitter (a) where the answers came from, (b) that
 * they can still edit before signing, and (c) that a wallet connection is
 * about to be requested.
 *
 * Wallet enforcement itself lives in `useFormSubmission` — submit while
 * disconnected stashes the values and pops `WalletConnectModal`. This banner
 * just sets expectations beforehand so the connect prompt doesn't feel like
 * it came out of nowhere.
 */
export function PrefillBanner() {
  return (
    <div className="border-b px-6 py-3 text-xs">
      <div className="flex items-center gap-2">
        <Globe className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        <span>
          Loaded answers from a <strong>Walrus Site</strong> share — review then submit. You&apos;ll
          be asked to connect a wallet to sign + encrypt your response on-chain.
        </span>
      </div>
    </div>
  );
}
