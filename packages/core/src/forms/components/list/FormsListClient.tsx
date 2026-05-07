'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Plus, Wallet } from 'lucide-react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { Button } from '../../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { WalletButton } from '../../../sui/wallet-ui';
import { useCreateDraft } from '../../hooks/use-create-draft';
import { useForms } from '../../hooks/use-forms';
import { useOnChainForms } from '../../hooks/use-on-chain-forms';
import { MarketplaceBrowse } from '../marketplace';
import { ThemeToggle } from '../editor/ThemeToggle';
import { DraftsBody, OnChainFormsBody, TemplatesBody } from './list-bodies';
import { EmptyState } from './list-shared';

type TopTab = 'drafts' | 'mine' | 'marketplace';
type MineTab = 'on-chain-running' | 'on-chain-ended' | 'marketplace';

/**
 * Tabbed forms list. All transactional flows (close form, treasury withdraw,
 * draft creation) live in dedicated hooks; this component just routes tab
 * state to body components.
 */
export function FormsListClient() {
  const router = useRouter();
  const { isConnected } = useCurrentWallet();
  const { forms, isLoading: draftsLoading, error: draftsError, deleteForm } = useForms();
  const {
    running,
    ended,
    templates,
    isLoading: chainLoading,
    error: chainError,
    packageMissing,
  } = useOnChainForms();
  const { createAndOpen, isCreating } = useCreateDraft();

  const [top, setTop] = useState<TopTab>('drafts');
  const [mine, setMine] = useState<MineTab>('on-chain-running');

  const myFormsCount = isConnected ? running.length + ended.length + templates.length : 0;

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
      <header className="bg-background relative z-10 border-b">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-semibold">Forms</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {top === 'drafts' && (
              <Button onClick={() => void createAndOpen()} disabled={isCreating}>
                <Plus className="mr-1.5 h-4 w-4" />
                {isCreating ? 'Creating…' : 'New form'}
              </Button>
            )}
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6">
        <Tabs value={top} onValueChange={(v) => setTop(v as TopTab)} className="flex flex-col">
          <TabsList className="rounded-none">
            <TabsTrigger
              value="drafts"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none"
            >
              Drafts ({forms.length})
            </TabsTrigger>
            <TabsTrigger
              value="mine"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none"
            >
              My Forms ({myFormsCount})
            </TabsTrigger>
            <TabsTrigger
              value="marketplace"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-none"
            >
              Marketplace
            </TabsTrigger>
          </TabsList>

          <TabsContent value="drafts" className="mt-6">
            <DraftsBody
              isLoading={draftsLoading}
              error={draftsError}
              forms={forms}
              onDelete={deleteForm}
              onCreate={createAndOpen}
              isCreating={isCreating}
              onRetry={() => router.refresh()}
            />
          </TabsContent>

          <TabsContent value="marketplace" className="mt-6">
            <MarketplaceBrowse />
          </TabsContent>

          <TabsContent value="mine" className="mt-6">
            {!isConnected ? (
              <EmptyState
                icon={<Wallet className="text-muted-foreground h-8 w-8" />}
                title="Connect a wallet to see your forms"
                description="My Forms shows on-chain data tied to your wallet. Drafts are stored locally and stay in the Drafts tab."
              />
            ) : packageMissing ? (
              <EmptyState
                icon={<Lock className="text-muted-foreground h-8 w-8" />}
                title="walform package not configured"
                description="Set NEXT_PUBLIC_PACKAGE_ID for the active network in .env.local to load on-chain forms."
              />
            ) : (
              <Tabs
                value={mine}
                onValueChange={(v) => setMine(v as MineTab)}
                className="flex flex-col"
              >
                <TabsList className="rounded-none">
                  <TabsTrigger value="on-chain-running">Running ({running.length})</TabsTrigger>
                  <TabsTrigger value="on-chain-ended">Ended ({ended.length})</TabsTrigger>
                  <TabsTrigger value="marketplace">Marketplace ({templates.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="on-chain-running" className="mt-6">
                  <OnChainFormsBody
                    isLoading={chainLoading}
                    error={chainError}
                    items={running}
                    emptyTitle="No running forms"
                    emptyDescription="Publish a draft to start accepting submissions."
                  />
                </TabsContent>
                <TabsContent value="on-chain-ended" className="mt-6">
                  <OnChainFormsBody
                    isLoading={chainLoading}
                    error={chainError}
                    items={ended}
                    emptyTitle="No ended forms"
                    emptyDescription="Forms past their close date or closed manually show up here."
                  />
                </TabsContent>
                <TabsContent value="marketplace" className="mt-6">
                  <TemplatesBody isLoading={chainLoading} error={chainError} items={templates} />
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
