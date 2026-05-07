'use client';

import { useEffect, useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../../ui/command';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../../../ui/hover-card';
import { filterAndRank } from '../../lib/field-search';
import { FIELD_TYPE_GROUPS, type FieldTypeGroup, type FieldTypeMeta } from '../../lib/field-types';
import type { FieldType } from '../../../types';
import { FieldTypeIcon } from '../FieldTypeIcon';

interface FieldPaletteContentProps {
  onSelect: (type: FieldType) => void;
  /**
   * Optional placeholder for the search input. Defaults to "Search fields…".
   */
  searchPlaceholder?: string;
}

/**
 * The shared palette UI used by both `BlockPalette` (the bottom "+ Add field"
 * button) and `InsertPalette` (the `+` button in each field block's hover
 * gutter). Includes search, grouped results, and a per-item hover card.
 */
export function FieldPaletteContent({
  onSelect,
  searchPlaceholder = 'Search fields…',
}: FieldPaletteContentProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const results = filterAndRank(debouncedQuery);
  const isSearching = debouncedQuery.trim().length > 0;

  const grouped: Record<FieldTypeGroup, FieldTypeMeta[]> = {
    Inputs: [],
    Choices: [],
    'Date & Time': [],
    Layout: [],
  };
  if (!isSearching) {
    for (const meta of results) grouped[meta.group].push(meta);
  }

  const renderItem = (meta: FieldTypeMeta) => {
    const { type, label, description, examples } = meta;
    return (
      <HoverCard key={type} openDelay={400} closeDelay={0}>
        <CommandItem onSelect={() => onSelect(type)}>
          <HoverCardTrigger asChild>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <FieldTypeIcon type={type} className="text-muted-foreground shrink-0" />
              <span className="font-medium">{label}</span>
            </div>
          </HoverCardTrigger>
        </CommandItem>
        <HoverCardContent side="right" align="start" className="w-60">
          <div className="flex items-start gap-3">
            <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <FieldTypeIcon type={type} className="text-foreground h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-tight font-semibold">{label}</p>
              <p className="text-muted-foreground mt-1 text-xs leading-snug">{description}</p>
              <p className="text-muted-foreground/70 mt-2 text-xs">e.g. {examples}</p>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  return (
    <Command shouldFilter={false}>
      <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No fields match &ldquo;{debouncedQuery}&rdquo;</CommandEmpty>
        {isSearching ? (
          <CommandGroup>{results.map(renderItem)}</CommandGroup>
        ) : (
          FIELD_TYPE_GROUPS.map((group) =>
            grouped[group].length === 0 ? null : (
              <CommandGroup key={group} heading={group}>
                {grouped[group].map(renderItem)}
              </CommandGroup>
            ),
          )
        )}
      </CommandList>
    </Command>
  );
}
