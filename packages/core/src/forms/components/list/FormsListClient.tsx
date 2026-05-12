'use client';

import { type ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Lock, Wallet } from 'lucide-react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { useForms } from '../../hooks/use-forms';
import { useOnChainForms } from '../../hooks/use-on-chain-forms';
import { MarketplaceBrowse } from '../marketplace';
import { FormCard } from './FormCard';
import { FormsHeader } from './FormsHeader';
import { OnChainFormCard } from './OnChainFormCard';
import { EmptyState, ErrorState, GridSkeleton } from './list-shared';

type TopTab = 'forms' | 'marketplace';

export function FormsListClient() {
  const router = useRouter();
  const { isConnected } = useCurrentWallet();
  const { forms, isLoading: draftsLoading, error: draftsError, deleteForm } = useForms();
  const {
    running,
    isLoading: chainLoading,
    error: chainError,
    packageMissing,
  } = useOnChainForms();
  const [top, setTop] = useState<TopTab>('forms');

  const formsCount = forms.length + (isConnected ? running.length : 0);
  const isLoading = draftsLoading || (isConnected && chainLoading);
  const error = draftsError ?? chainError;
  const showRunningEmpty = isConnected && !packageMissing;

  return (
    <div className="bg-background relative min-h-screen [--forms-dot:rgba(0,0,0,0.14)] dark:[--forms-dot:rgba(255,255,255,0.12)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--forms-dot) 1px, transparent 1.3px)',
          backgroundSize: '20px 20px',
          maskImage: 'radial-gradient(ellipse 100% 80% at 50% 0%, black 30%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 100% 80% at 50% 0%, black 30%, transparent 100%)',
        }}
      />
      <FormsHeader />

      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6">
        <Tabs value={top} onValueChange={(v) => setTop(v as TopTab)} className="flex flex-col">
          <TabsList className="rounded-none">
            <TabsTrigger
              value="forms"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none"
            >
              Forms ({formsCount})
            </TabsTrigger>
            <TabsTrigger
              value="marketplace"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none"
            >
              Marketplace
            </TabsTrigger>
          </TabsList>

          <TabsContent value="forms" className="mt-6">
            {isLoading ? (
              <GridSkeleton />
            ) : error ? (
              <ErrorState message={error.message} onRetry={() => router.refresh()} />
            ) : !isConnected && forms.length === 0 ? (
              <EmptyState
                icon={<Wallet className="text-muted-foreground h-8 w-8" />}
                title="Connect a wallet to see published forms"
                description="Drafts stay on this device. Connect a wallet to load forms you've already published on-chain."
              />
            ) : packageMissing && forms.length === 0 ? (
              <EmptyState
                icon={<Lock className="text-muted-foreground h-8 w-8" />}
                title="walform package not configured"
                description="Set NEXT_PUBLIC_PACKAGE_ID for the active network in .env.local to load on-chain forms."
              />
            ) : forms.length === 0 && running.length === 0 ? (
              <EmptyState
                icon={<FileText className="text-muted-foreground h-8 w-8" />}
                title="No forms yet"
                description="Create your first form — drafts live locally until you publish."
              />
            ) : (
              <div className="flex flex-col gap-8">
                {showRunningEmpty || running.length > 0 ? (
                  <Section
                    title="Running"
                    count={running.length}
                    emptyHint={
                      running.length === 0
                        ? 'No running forms yet. Publish a draft to start collecting responses.'
                        : null
                    }
                  >
                    {running.map((f) => (
                      <OnChainFormCard key={f.formId} form={f} />
                    ))}
                  </Section>
                ) : null}
                <Section
                  title="Drafts"
                  count={forms.length}
                  emptyHint={
                    forms.length === 0
                      ? 'No drafts. Create a new form to start authoring.'
                      : null
                  }
                >
                  {forms.map((form) => (
                    <FormCard key={form.id} form={form} onDelete={deleteForm} />
                  ))}
                </Section>
              </div>
            )}
          </TabsContent>

          <TabsContent value="marketplace" className="mt-6">
            <MarketplaceBrowse />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

interface SectionProps {
  title: string;
  count: number;
  emptyHint: string | null;
  children: ReactNode;
}

function Section({ title, count, emptyHint, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase">{title}</h2>
        <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
      </div>
      {emptyHint ? (
        <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
          {emptyHint}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      )}
    </section>
  );
}
