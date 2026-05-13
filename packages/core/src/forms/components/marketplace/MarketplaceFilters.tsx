'use client';

import { Search, X } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';

export type MarketplaceSort =
  | 'newest'
  | 'oldest'
  | 'most-cloned'
  | 'least-cloned'
  | 'most-upvoted'
  | 'top-rated';
export type MarketplaceStatusFilter = 'all' | 'free' | 'paid';
/** -1 = all, else u8 category. */
export type MarketplaceCategoryFilter = number;

export interface MarketplaceFilterState {
  search: string;
  category: MarketplaceCategoryFilter;
  status: MarketplaceStatusFilter;
  sort: MarketplaceSort;
}

export const DEFAULT_FILTERS: MarketplaceFilterState = {
  search: '',
  category: -1,
  status: 'all',
  sort: 'newest',
};

export const CATEGORY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: -1, label: 'All categories' },
  { value: 0, label: 'Survey' },
  { value: 1, label: 'NPS' },
  { value: 2, label: 'Event RSVP' },
  { value: 3, label: 'Lead form' },
  { value: 4, label: 'Other' },
];

const SORT_OPTIONS: Array<{ value: MarketplaceSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most-cloned', label: 'Most cloned' },
  { value: 'least-cloned', label: 'Least cloned' },
  { value: 'most-upvoted', label: 'Most upvoted' },
  { value: 'top-rated', label: 'Top rated (up − down)' },
];

const STATUS_OPTIONS: Array<{ value: MarketplaceStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'For sale' },
];

interface MarketplaceFiltersProps {
  value: MarketplaceFilterState;
  onChange: (next: MarketplaceFilterState) => void;
  resultCount: number;
}

export function MarketplaceFilters({ value, onChange, resultCount }: MarketplaceFiltersProps) {
  const hasActive =
    value.search !== '' ||
    value.category !== -1 ||
    value.status !== 'all' ||
    value.sort !== 'newest';

  const reset = () => onChange(DEFAULT_FILTERS);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search title, description, or tag…"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            className="pl-9"
          />
        </div>

        <Select
          value={String(value.category)}
          onValueChange={(v) => onChange({ ...value, category: Number(v) })}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.sort}
          onValueChange={(v) => onChange({ ...value, sort: v as MarketplaceSort })}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={value.status === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ ...value, status: opt.value })}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <div className="text-muted-foreground ml-auto flex items-center gap-3 text-xs">
          <span>
            {resultCount} {resultCount === 1 ? 'template' : 'templates'}
          </span>
          {hasActive && (
            <Button variant="ghost" size="sm" onClick={reset} className="h-7 px-2">
              <X className="mr-1 h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
