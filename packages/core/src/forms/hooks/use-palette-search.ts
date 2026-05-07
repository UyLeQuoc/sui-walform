'use client';

import { useMemo, useState } from 'react';
import { filterAndRank } from '../lib/field-search';
import {
  FIELD_TYPE_GROUPS,
  type FieldTypeGroup,
  type FieldTypeMeta,
  getFieldTypesByGroup,
} from '../lib/field-types';

export interface UsePaletteSearchResult {
  query: string;
  setQuery: (q: string) => void;
  /** True once the user has typed something. Drives the search-vs-grouped layout. */
  searching: boolean;
  /** Ranked results when searching. Empty otherwise. */
  searchResults: FieldTypeMeta[];
  /** Field types pre-bucketed by group, used when not searching. */
  grouped: Record<FieldTypeGroup, FieldTypeMeta[]>;
  openGroups: string[];
  setOpenGroups: (groups: string[]) => void;
}

/**
 * Search + accordion state for the field palette. Keeps the lookups
 * memoized so that re-renders during a drag don't rebuild the grouped
 * map or re-rank the search hits.
 */
export function usePaletteSearch(): UsePaletteSearchResult {
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<string[]>([...FIELD_TYPE_GROUPS]);

  const grouped = useMemo(() => getFieldTypesByGroup(), []);
  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length > 0;
  const searchResults = useMemo(
    () => (searching ? filterAndRank(trimmedQuery) : []),
    [searching, trimmedQuery],
  );

  return {
    query,
    setQuery,
    searching,
    searchResults,
    grouped,
    openGroups,
    setOpenGroups,
  };
}
