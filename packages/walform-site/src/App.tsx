import { Component, type ReactNode, useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { Providers } from '@walform/core/ui/providers';
import { Toaster } from '@walform/core/ui/sonner';
import { Logo } from '@walform/core/ui/logo';
import { FormSubmissionView } from '@walform/core/forms/components/submit';

type Network = 'testnet' | 'mainnet';

interface ShellConfig {
  formId: string;
  network?: Network;
}

function readHashId(): string | null {
  const m = /^#\/f\/(0x[0-9a-fA-F]+)\/?$/.exec(window.location.hash);
  return m?.[1] ?? null;
}

/**
 * Mode B entry — Walrus-hosted static shell. Resolution order:
 *   1. /config.json  (production — baked into the bundle by the Deploy button)
 *   2. #/f/<formId>  (hash route — dev / debugging)
 *   3. Landing       (help card)
 * For local dev: http://localhost:3002/#/f/<formId>
 */
function Shell() {
  const { network: activeNetwork, selectNetwork } = useSuiClientContext();
  const [formId, setFormId] = useState<string | null>(readHashId);
  const [resolved, setResolved] = useState(formId !== null);

  useEffect(() => {
    let cancelled = false;

    const onHashChange = () => {
      const id = readHashId();
      if (id) setFormId(id);
    };
    window.addEventListener('hashchange', onHashChange);

    if (!resolved) {
      void fetch('/config.json', { cache: 'no-store' })
        .then((r) => (r.ok ? (r.json() as Promise<ShellConfig>) : null))
        .then((cfg) => {
          if (cancelled) return;
          if (cfg && typeof cfg.formId === 'string' && cfg.formId.startsWith('0x')) {
            if (cfg.network && cfg.network !== activeNetwork) {
              selectNetwork(cfg.network);
            }
            setFormId(cfg.formId);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setResolved(true);
        });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', onHashChange);
    };
    // Run once on mount — selectNetwork is stable; activeNetwork changing
    // should not retrigger the fetch/setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!resolved) return null;
  if (!formId) return <Landing />;
  return <FormSubmissionView formId={formId} />;
}

function ShellHeader() {
  return (
    <header className="bg-card/60 flex w-full items-center justify-between border-b px-4 py-3 backdrop-blur">
      <a href="https://walform.wal.app" className="flex items-center gap-2" aria-label="WalForm">
        <Logo className="size-5" />
        <span className="text-sm font-semibold tracking-tight">WalForm</span>
      </a>
      <span className="text-muted-foreground text-xs">Hosted on Walrus</span>
    </header>
  );
}

function Landing() {
  return (
    <div className="bg-secondary/40 flex min-h-screen flex-col">
      <ShellHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="bg-card flex max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center shadow-xl">
          <Logo className="size-8" />
          <h1 className="text-lg font-semibold">No form to show</h1>
          <p className="text-muted-foreground text-sm">
            This WalForm site isn&apos;t pointing at a form yet. A deployed form opens
            automatically; to open one manually, append{' '}
            <code className="font-mono text-xs">#/f/&lt;formId&gt;</code> to the URL.
          </p>
          <p className="text-muted-foreground/70 text-xs">
            Decentralized, end-to-end-encrypted forms on Sui + Walrus.
          </p>
        </div>
      </main>
    </div>
  );
}

function ErrorFallback({ message }: { message: string }) {
  return (
    <div className="bg-secondary/40 flex min-h-screen flex-col">
      <ShellHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
        <Logo className="size-8" />
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground max-w-lg text-sm">
          {message || 'An unexpected error occurred while loading this form.'}
        </p>
      </main>
    </div>
  );
}

// React requires a class for error boundaries (no hook equivalent). App-level
// only — core stays function-components-only per CODE_RULES.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  render() {
    if (this.state.error) return <ErrorFallback message={this.state.error.message} />;
    return this.props.children;
  }
}

export function App() {
  return (
    <Providers>
      <MemoryRouter>
        <ErrorBoundary>
          <Shell />
        </ErrorBoundary>
      </MemoryRouter>
      <Toaster richColors position="bottom-right" />
    </Providers>
  );
}
