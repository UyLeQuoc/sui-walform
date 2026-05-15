import { DeployBuilderButton, PlatformTreasuryCard } from '@walform/core/forms/components/admin';
import { FormsHeader } from '@walform/core/forms/components/list';

export const metadata = {
  title: 'Platform admin · WalForm',
};

export default function AdminPage() {
  return (
    <div className="bg-background min-h-screen">
      <FormsHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
        <section>
          <div className="mb-6 flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Platform admin</h1>
            <p className="text-muted-foreground text-sm">
              Withdraw accumulated marketplace royalties (10% of every paid clone, floor 0.05
              SUI). Only the wallet holding the <code className="font-mono">PlatformAdminCap</code>{' '}
              can sign.
            </p>
          </div>
          <PlatformTreasuryCard />
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">Decentralized hosting</h2>
            <p className="text-muted-foreground text-sm">
              Push the static-exported builder to a Walrus Site, then optionally link a SuiNS
              name so it&apos;s reachable at <code className="font-mono">your-name.wal.app</code>.
              No server, no CDN, no DNS — fully on-chain.
            </p>
          </div>
          <DeployBuilderButton />
        </section>
      </main>
    </div>
  );
}
