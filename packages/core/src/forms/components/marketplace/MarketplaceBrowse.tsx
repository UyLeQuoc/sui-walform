'use client';

import { useMemo, useState } from 'react';
import { Store } from 'lucide-react';
import {
  useMarketplaceTemplates,
  type MarketplaceTemplate,
} from '../../hooks/use-marketplace-templates';
import { useMarketplaceVotes, type TemplateVoteCounts } from '../../hooks/use-marketplace-votes';
import { EmptyState } from '../list/list-shared';
import { MarketplaceCard } from './MarketplaceCard';
import {
  DEFAULT_FILTERS,
  MarketplaceFilters,
  type MarketplaceFilterState,
} from './MarketplaceFilters';

/**
 * Marketplace tab body. Owns filter/sort state + client-side filtering. Pulls
 * templates + vote counts in parallel; cards receive their votes via prop so
 * we don't fan out N more queries from the cards themselves.
 */
export function MarketplaceBrowse() {
  const { templates, isLoading, error, packageMissing } = useMarketplaceTemplates();
  const { byTemplate: votesByTemplate } = useMarketplaceVotes();
  const [filters, setFilters] = useState<MarketplaceFilterState>(DEFAULT_FILTERS);

  const filtered = useMemo(
    () => applyFilters(templates, votesByTemplate, filters),
    [templates, votesByTemplate, filters],
  );

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
      <div className="flex flex-col gap-4">
        <MarketplaceFilters value={filters} onChange={setFilters} resultCount={0} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-muted h-44 animate-pulse rounded-xl" />
          ))}
        </div>
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
    <div className="flex flex-col gap-8">
      <MarketplaceFilters value={filters} onChange={setFilters} resultCount={filtered.length} />
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase">Templates</h2>
          <span className="text-muted-foreground text-xs tabular-nums">{filtered.length}</span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Store className="text-muted-foreground h-8 w-8" />}
            title="No matches"
            description="Try widening the filters or clearing the search."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <MarketplaceCard
                key={t.templateId}
                template={t}
                votes={votesByTemplate.get(t.templateId) ?? null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function applyFilters(
  templates: MarketplaceTemplate[],
  votesByTemplate: Map<string, TemplateVoteCounts>,
  filters: MarketplaceFilterState,
): MarketplaceTemplate[] {
  const needle = filters.search.trim().toLowerCase();
  const matchesSearch = (t: MarketplaceTemplate) => {
    if (!needle) return true;
    return (
      t.title.toLowerCase().includes(needle) ||
      t.description.toLowerCase().includes(needle) ||
      t.tags.some((tag) => tag.toLowerCase().includes(needle))
    );
  };
  const matchesCategory = (t: MarketplaceTemplate) =>
    filters.category === -1 || t.category === filters.category;
  const matchesStatus = (t: MarketplaceTemplate) => {
    if (filters.status === 'all') return t.status !== 'owned';
    if (filters.status === 'free') return t.status === 'free';
    if (filters.status === 'paid') return t.status === 'paid';
    return true;
  };

  const filtered = templates.filter(
    (t) => matchesSearch(t) && matchesCategory(t) && matchesStatus(t),
  );

  const upvotesOf = (t: MarketplaceTemplate) => votesByTemplate.get(t.templateId)?.upvotes ?? 0;
  const scoreOf = (t: MarketplaceTemplate) => {
    const v = votesByTemplate.get(t.templateId);
    return v ? v.upvotes - v.downvotes : 0;
  };

  const sorted = [...filtered];
  switch (filters.sort) {
    case 'newest':
      sorted.sort((a, b) => b.createdAtMs - a.createdAtMs);
      break;
    case 'oldest':
      sorted.sort((a, b) => a.createdAtMs - b.createdAtMs);
      break;
    case 'most-cloned':
      sorted.sort((a, b) => b.cloneCount - a.cloneCount);
      break;
    case 'least-cloned':
      sorted.sort((a, b) => a.cloneCount - b.cloneCount);
      break;
    case 'most-upvoted':
      sorted.sort((a, b) => upvotesOf(b) - upvotesOf(a));
      break;
    case 'top-rated':
      sorted.sort((a, b) => scoreOf(b) - scoreOf(a));
      break;
  }
  return sorted;
}
