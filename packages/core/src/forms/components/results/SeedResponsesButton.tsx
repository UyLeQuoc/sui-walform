'use client';

import { useState } from 'react';
import { Beaker, ChevronDown, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import {
  clearSeededSubmissions,
  seedSubmissions,
} from '../../services/dev-seed-submissions';
import type { FormField } from '../../../types';

const SEED_COUNTS = [5, 10, 25, 50] as const;

interface SeedResponsesButtonProps {
  formId: string;
  fields: FormField[];
  /** Current count of seeded rows already in the store. Drives the "Clear"
   *  item's disabled state and the toast wording. */
  seededCount: number;
}

/**
 * Dev-only seeder for the Results page. Returns null outside development so
 * the component fully tree-shakes from prod builds (Next inlines NODE_ENV at
 * build time). Generates fake decrypted submissions in module-level memory —
 * no chain, no Seal, no wallet.
 */
export function SeedResponsesButton({
  formId,
  fields,
  seededCount,
}: SeedResponsesButtonProps) {
  const [pending, setPending] = useState<'seed' | 'clear' | null>(null);

  if (process.env.NODE_ENV !== 'development') return null;

  const handleSeed = (count: number) => {
    setPending('seed');
    try {
      const added = seedSubmissions(formId, fields, count);
      toast.success(
        `Seeded ${added.length} fake response${added.length === 1 ? '' : 's'}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Seed failed: ${msg}`);
    } finally {
      setPending(null);
    }
  };

  const handleClear = () => {
    setPending('clear');
    try {
      const n = clearSeededSubmissions(formId);
      toast.success(`Cleared ${n} fake response${n === 1 ? '' : 's'}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Clear failed: ${msg}`);
    } finally {
      setPending(null);
    }
  };

  const isBusy = pending !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          title="Seed fake responses (development only)"
        >
          {isBusy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Beaker className="mr-1.5 h-3.5 w-3.5" />
          )}
          Seed
          {seededCount > 0 && (
            <span className="text-muted-foreground ml-1 tabular-nums">({seededCount})</span>
          )}
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Seed fake responses</DropdownMenuLabel>
        {SEED_COUNTS.map((n) => (
          <DropdownMenuItem
            key={n}
            disabled={isBusy}
            onSelect={(e) => {
              e.preventDefault();
              handleSeed(n);
            }}
          >
            + {n} responses
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isBusy || seededCount === 0}
          className="text-destructive focus:text-destructive"
          onSelect={(e) => {
            e.preventDefault();
            handleClear();
          }}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Clear seeded responses
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
