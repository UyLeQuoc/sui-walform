'use client';

import { Store } from 'lucide-react';
import { useMarketplaceTemplates } from '../../hooks/use-marketplace-templates';
import { EmptyState } from '../list/list-shared';
import { MarketplaceCard } from './MarketplaceCard';

/**
 * Marketplace tab body. All purchase flow logic (free clone, paid multi-buyer,
 * legacy 1-of-1 kiosk) lives in `useTemplatePurchase`; this just routes
 * loading/error/empty states and lays out the card grid.
 */
export function MarketplaceBrowse() {
  const { templates, isLoading, error, packageMissing } = useMarketplaceTemplates();

  if (packageMissing) {
    return (
      <EmptyState
        icon={<Store className="text-muted-foreground h-8 w-8" />}
        title="Marketplace unavailable"
        description="walform package not configured for this network."
      />
    );
  }
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted h-40 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive text-sm">Failed to load marketplace: {error.message}</p>
      </div>
    );
  }
  if (templates.length === 0) {
    return (
      <EmptyState
        icon={<Store className="text-muted-foreground h-8 w-8" />}
        title="No templates yet"
        description="Be the first to publish one — anyone can share a template for free or list it for sale."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => (
        <MarketplaceCard key={t.templateId} template={t} />
      ))}
    </div>
  );
}
