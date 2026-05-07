'use client';

import * as React from 'react';
import { getCountries, getCountryCallingCode } from 'react-phone-number-input';
import type { Country } from 'react-phone-number-input';
import en from 'react-phone-number-input/locale/en.json';
import flags from 'react-phone-number-input/flags';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '../../../../ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../../../ui/command';
import { Field, FieldLabel } from '../../../../ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../ui/popover';
import { cn } from '../../../../lib/utils';
import { useFormBuilderStore } from '../../../store/form-builder-store';
import type { FormField } from '../../../../types';
import { ScrollArea } from '../../../../ui/scroll-area';

const ALL_COUNTRIES = getCountries();
const LABELS = en as Record<string, string>;

function filterCountries(query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_COUNTRIES;
  return ALL_COUNTRIES.filter((code) => {
    const name = (LABELS[code] ?? '').toLowerCase();
    const dial = getCountryCallingCode(code);
    return name.includes(q) || dial.includes(q.replace(/^\+/, '')) || code.toLowerCase() === q;
  });
}

interface FlagProps {
  country: Country;
}

function Flag({ country }: FlagProps) {
  const FlagSvg = flags[country];
  return (
    <span className="bg-foreground/20 flex h-4 w-6 shrink-0 overflow-hidden rounded-xs [&_svg:not([class*='size-'])]:size-full">
      {FlagSvg && <FlagSvg title={LABELS[country] ?? country} />}
    </span>
  );
}

interface PhoneSettingsProps {
  field: FormField;
}

export function PhoneSettings({ field }: PhoneSettingsProps) {
  const updateField = useFormBuilderStore((s) => s.updateField);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const selectedCode = (field.defaultCountry ?? 'US') as Country;
  const results = filterCountries(query);

  return (
    <Field>
      <FieldLabel>Default country</FieldLabel>
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setQuery('');
        }}
        modal={true}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Flag country={selectedCode} />
              <span className="truncate">{LABELS[selectedCode]}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                +{getCountryCallingCode(selectedCode)}
              </span>
            </span>
            <ChevronsUpDown className="text-muted-foreground ml-2 h-4 w-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name or +code…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-none overflow-hidden">
              <ScrollArea className="h-72">
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup>
                  {results.map((code) => (
                    <CommandItem
                      key={code}
                      data-checked={code === selectedCode ? 'true' : undefined}
                      onSelect={() => {
                        updateField(field.id, { defaultCountry: code });
                        setOpen(false);
                        setQuery('');
                      }}
                      className={cn('gap-2')}
                    >
                      <Flag country={code} />
                      <span className="min-w-0 flex-1 truncate">{LABELS[code]}</span>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        +{getCountryCallingCode(code)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </Field>
  );
}
