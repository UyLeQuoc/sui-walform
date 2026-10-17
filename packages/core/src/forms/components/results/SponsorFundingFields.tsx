'use client';

import { useId } from 'react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '../../../ui/input-group';

interface SponsorFundingFieldsProps {
  wal: string;
  sui: string;
  onWalChange: (next: string) => void;
  onSuiChange: (next: string) => void;
}

/** WAL (storage) + SUI (relay tips) amounts for opening or topping up a pool. */
export function SponsorFundingFields({
  wal,
  sui,
  onWalChange,
  onSuiChange,
}: SponsorFundingFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <AmountField
        label="Storage"
        unit="WAL"
        hint="Pays for respondents' Walrus storage."
        value={wal}
        onChange={onWalChange}
      />
      <AmountField
        label="Relay tips"
        unit="SUI"
        hint="A little SUI for upload-relay tips."
        value={sui}
        onChange={onSuiChange}
      />
    </div>
  );
}

function AmountField({
  label,
  unit,
  hint,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  hint: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <InputGroup>
        <InputGroupInput
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="tabular-nums"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{unit}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <p className="text-muted-foreground text-[11px]">{hint}</p>
    </div>
  );
}
