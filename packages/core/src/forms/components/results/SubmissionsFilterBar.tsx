'use client';

import { Search, X } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  type SubmissionPriority,
  type SubmissionStatus,
} from '../../services/submission-tags-db';

export interface SubmissionsFilterState {
  search: string;
  /** Empty set = no status filter (all). */
  statuses: Set<SubmissionStatus>;
  /** Empty set = no priority filter (all). */
  priorities: Set<SubmissionPriority>;
  /** When true, only show submissions whose body has been Seal-decrypted. */
  decryptedOnly: boolean;
}

export const DEFAULT_SUBMISSION_FILTERS: SubmissionsFilterState = {
  search: '',
  statuses: new Set(),
  priorities: new Set(),
  decryptedOnly: false,
};

interface SubmissionsFilterBarProps {
  value: SubmissionsFilterState;
  onChange: (next: SubmissionsFilterState) => void;
  total: number;
  visible: number;
}

export function SubmissionsFilterBar({
  value,
  onChange,
  total,
  visible,
}: SubmissionsFilterBarProps) {
  const toggleStatus = (s: SubmissionStatus) => {
    const next = new Set(value.statuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onChange({ ...value, statuses: next });
  };
  const togglePriority = (p: SubmissionPriority) => {
    const next = new Set(value.priorities);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    onChange({ ...value, priorities: next });
  };
  const hasActive =
    value.search !== '' ||
    value.statuses.size > 0 ||
    value.priorities.size > 0 ||
    value.decryptedOnly;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search decrypted answers, submitter address…"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button
          size="sm"
          variant={value.decryptedOnly ? 'default' : 'outline'}
          className="h-8"
          onClick={() => onChange({ ...value, decryptedOnly: !value.decryptedOnly })}
        >
          Decrypted only
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-muted-foreground mr-1 text-[10px] tracking-wide uppercase">
          Status
        </span>
        {STATUS_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={value.statuses.has(opt.value) ? 'default' : 'outline'}
            className="h-7 px-2 text-[11px]"
            onClick={() => toggleStatus(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-muted-foreground mr-1 text-[10px] tracking-wide uppercase">
          Priority
        </span>
        {PRIORITY_OPTIONS.filter((p) => p.value !== 'none').map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={value.priorities.has(opt.value) ? 'default' : 'outline'}
            className="h-7 px-2 text-[11px]"
            onClick={() => togglePriority(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
        <div className="text-muted-foreground ml-auto flex items-center gap-2 text-[11px]">
          <span>
            {visible} / {total}
          </span>
          {hasActive && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              onClick={() => onChange(DEFAULT_SUBMISSION_FILTERS)}
            >
              <X className="mr-1 h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
