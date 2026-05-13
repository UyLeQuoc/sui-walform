'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Lock,
  Search,
} from 'lucide-react';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Input } from '../../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Spinner } from '../../../ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../ui/table';
import { suivisionUrl, type ExplorerNetwork } from '../../../sui/explorer';
import { shortAddr } from '../../lib/format-address';
import { formatCell } from '../../lib/format-submission-cell';
import type { SubmissionRow } from '../../hooks/use-form-submissions';
import type { DecryptedRow } from '../../hooks/use-submission-decryption';
import type { SubmissionPriority, SubmissionStatus } from '../../services/submission-tags-db';
import type { FormField } from '../../../types';
import { FileAttachmentView } from './FileAttachmentView';
import { PriorityPill, StatusPill } from './SubmissionTagPills';

interface SubmissionsDataTableProps {
  rows: SubmissionRow[];
  decryptedById: Record<string, DecryptedRow>;
  errorById: Record<string, string>;
  fields: FormField[];
  network: ExplorerNetwork;
  canDecrypt: boolean;
  pendingId: string | null;
  onDecrypt: (row: SubmissionRow) => void;
  tagFor: (id: string) => { status: SubmissionStatus; priority: SubmissionPriority };
  onStatusChange: (id: string, next: SubmissionStatus) => void;
  onPriorityChange: (id: string, next: SubmissionPriority) => void;
}

export function SubmissionsDataTable({
  rows,
  decryptedById,
  errorById,
  fields,
  network,
  canDecrypt,
  pendingId,
  onDecrypt,
  tagFor,
  onStatusChange,
  onPriorityChange,
}: SubmissionsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'submittedAtMs', desc: true }]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const columns = useMemo<ColumnDef<SubmissionRow>[]>(
    () => [
      {
        accessorKey: 'submitter',
        header: ({ column }) => <SortHeader column={column} label="Submitter" />,
        cell: ({ row }) => (
          <code className="font-mono text-xs">{shortAddr(row.original.submitter)}</code>
        ),
      },
      {
        accessorKey: 'submittedAtMs',
        header: ({ column }) => <SortHeader column={column} label="Submitted at" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {new Date(row.original.submittedAtMs).toLocaleString()}
          </span>
        ),
        sortingFn: 'basic',
      },
      {
        id: 'priority',
        header: 'Priority',
        cell: ({ row }) => {
          const tag = tagFor(row.original.submissionId);
          return (
            <div
              role="presentation"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <PriorityPill
                value={tag.priority}
                onChange={(next) => onPriorityChange(row.original.submissionId, next)}
              />
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const tag = tagFor(row.original.submissionId);
          return (
            <div
              role="presentation"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <StatusPill
                value={tag.status}
                onChange={(next) => onStatusChange(row.original.submissionId, next)}
              />
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'decryption',
        header: 'Body',
        cell: ({ row }) => {
          const id = row.original.submissionId;
          if (decryptedById[id]) return <Badge variant="default">Decrypted</Badge>;
          if (errorById[id]) return <Badge variant="destructive">Error</Badge>;
          return <Badge variant="outline">Encrypted</Badge>;
        },
        enableSorting: false,
      },
    ],
    [decryptedById, errorById, onPriorityChange, onStatusChange, tagFor],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _columnId, value) => {
      const needle = String(value).toLowerCase().trim();
      if (!needle) return true;
      const submitter = row.original.submitter.toLowerCase();
      const id = row.original.submissionId.toLowerCase();
      if (submitter.includes(needle) || id.includes(needle)) return true;
      const decrypted = decryptedById[row.original.submissionId];
      if (!decrypted) return false;
      return Object.values(decrypted).some((v) => {
        if (v === null || v === undefined) return false;
        return String(v).toLowerCase().includes(needle);
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const openRow = rows.find((r) => r.submissionId === openId) ?? null;

  const pageCount = table.getPageCount();
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const firstRowIndex = filteredCount === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRowIndex = Math.min(filteredCount, (pageIndex + 1) * pageSize);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search submitters or decrypted answers…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <span className="text-muted-foreground ml-auto text-xs">
          {filteredCount} of {rows.length}
        </span>
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="h-9 text-xs">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground py-6 text-center text-sm"
                >
                  No responses match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(row.original.submissionId)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger className="h-7 w-[68px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground">
          {firstRowIndex}–{lastRowIndex} of {filteredCount}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.setPageIndex(0)}
            aria-label="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-muted-foreground px-2 tabular-nums">
            Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
          </span>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            disabled={!table.getCanNextPage()}
            onClick={() => table.setPageIndex(pageCount - 1)}
            aria-label="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Dialog open={!!openRow} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {openRow && (
            <SubmissionDetail
              row={openRow}
              decrypted={decryptedById[openRow.submissionId]}
              error={errorById[openRow.submissionId]}
              isPending={pendingId === openRow.submissionId}
              canDecrypt={canDecrypt}
              onDecrypt={() => onDecrypt(openRow)}
              fields={fields}
              network={network}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SortHeaderProps {
  column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean) => void };
  label: string;
}

function SortHeader({ column, label }: SortHeaderProps) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className="hover:text-foreground inline-flex items-center gap-1"
    >
      {label}
      {sorted === 'asc' ? (
        <ArrowUp className="h-3 w-3" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

interface SubmissionDetailProps {
  row: SubmissionRow;
  decrypted: DecryptedRow | undefined;
  error: string | undefined;
  isPending: boolean;
  canDecrypt: boolean;
  onDecrypt: () => void;
  fields: FormField[];
  network: ExplorerNetwork;
}

function SubmissionDetail({
  row,
  decrypted,
  error,
  isPending,
  canDecrypt,
  onDecrypt,
  fields,
  network,
}: SubmissionDetailProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-mono text-sm">{shortAddr(row.submissionId)}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span>
            from <code className="font-mono">{shortAddr(row.submitter)}</code>
          </span>
          <span>·</span>
          <span>{new Date(row.submittedAtMs).toLocaleString()}</span>
          <a
            href={suivisionUrl(network, 'object', row.submissionId)}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
          >
            on explorer
            <ExternalLink className="h-3 w-3" />
          </a>
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {!decrypted && (
          <Button onClick={onDecrypt} disabled={isPending || !canDecrypt} className="self-start">
            {isPending ? (
              <Spinner className="mr-1.5 size-3" />
            ) : (
              <Lock className="mr-1.5 h-3 w-3" />
            )}
            Decrypt
          </Button>
        )}
        {error && <p className="text-destructive text-xs">{error}</p>}
        {decrypted && (
          <dl className="flex flex-col gap-3 text-sm">
            {fields.map((f) => (
              <div key={f.id} className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs font-medium">{f.label || f.id}</dt>
                <dd className="break-words">{renderCell(f, decrypted[f.id])}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </>
  );
}

function renderCell(field: FormField, value: unknown): ReactNode {
  if (field.type === 'file') {
    if (!value) return <span className="text-muted-foreground/60">— not answered —</span>;
    return <FileAttachmentView value={value} />;
  }
  const formatted = formatCell(value);
  if (!formatted) return <span className="text-muted-foreground/60">— not answered —</span>;
  return formatted;
}
