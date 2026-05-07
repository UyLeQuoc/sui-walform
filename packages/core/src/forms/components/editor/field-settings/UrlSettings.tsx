'use client';

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Field, FieldLabel } from '../../../../ui/field';
import { Input } from '../../../../ui/input';
import { useFormBuilderStore } from '../../../store/form-builder-store';
import type { FormField } from '../../../../types';

interface DomainInputProps {
  onAdd: (domain: string) => void;
}

function DomainInput({ onAdd }: DomainInputProps) {
  const [value, setValue] = React.useState('');

  const handleAdd = () => {
    const trimmed = value
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    if (trimmed) {
      onAdd(trimmed);
      setValue('');
    }
  };

  return (
    <div className="flex w-full gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. google.com"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
          }
        }}
        className="flex-1"
      />
      <Button type="button" variant="outline" onClick={handleAdd}>
        <Plus />
        Add
      </Button>
    </div>
  );
}

interface UrlSettingsProps {
  field: FormField;
}

export function UrlSettings({ field }: UrlSettingsProps) {
  const updateField = useFormBuilderStore((s) => s.updateField);
  const domains = field.allowedDomains ?? [];

  return (
    <Field>
      <FieldLabel>Allowed domains</FieldLabel>
      <div className="flex flex-col gap-2">
        <DomainInput
          onAdd={(domain) => {
            if (!domains.includes(domain)) {
              updateField(field.id, { allowedDomains: [...domains, domain] });
            }
          }}
        />
        {domains.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {domains.map((domain) => (
              <span
                key={domain}
                className="bg-secondary text-secondary-foreground flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
              >
                {domain}
                <button
                  type="button"
                  onClick={() =>
                    updateField(field.id, {
                      allowedDomains: domains.filter((d) => d !== domain),
                    })
                  }
                  className="text-secondary-foreground/60 hover:text-secondary-foreground"
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Remove {domain}</span>
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">All domains accepted</p>
        )}
      </div>
    </Field>
  );
}
