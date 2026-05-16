'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
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
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  ExternalLink,
  Hash,
  Lock,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Spinner } from '../../../ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../ui/table';
import { suivisionUrl, type ExplorerNetwork } from '../../../sui/explorer';
import { shortAddr } from '../../lib/format-address';
import type { SubmissionRow } from '../../hooks/use-form-submissions';
import type { DecryptedRow } from '../../hooks/use-submission-decryption';
import type { SubmissionPriority, SubmissionStatus } from '../../services/submission-tags-db';
import type { FormField } from '../../../types';
import { QuestionCard } from './QuestionCard';
import { PriorityPill, StatusPill } from './SubmissionTagPills';

interface SubmissionsDataTableProps {
  rows: SubmissionRow[];
  decryptedById: Record<string, DecryptedRow>;
  errorById: Record<string, string>;
  fields: FormField[];
  network: ExplorerNetwork;
  canDecrypt: boolean;
  pendingIds: ReadonlySet<string>;
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
  pendingIds,
  onDecrypt,
  tagFor,
  onStatusChange,
  onPriorityChange,
}: SubmissionsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'submittedAtMs', desc: true }]);
  const [openId, setOpenId] = useState<string | null>(null);
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
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const openIndex = openId ? rows.findIndex((r) => r.submissionId === openId) : -1;
  const openRow = openIndex >= 0 ? rows[openIndex]! : null;
  const goPrev = () => {
    if (openIndex > 0) setOpenId(rows[openIndex - 1]!.submissionId);
  };
  const goNext = () => {
    if (openIndex >= 0 && openIndex < rows.length - 1) {
      setOpenId(rows[openIndex + 1]!.submissionId);
    }
  };

  const pageCount = table.getPageCount();
  const totalCount = rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const firstRowIndex = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRowIndex = Math.min(totalCount, (pageIndex + 1) * pageSize);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
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
                  No responses to show.
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
            {firstRowIndex}–{lastRowIndex} of {totalCount}
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
          <DialogContent
            className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-3xl"
            showCloseButton={false}
          >
            {openRow && (
              <SubmissionDetail
                row={openRow}
                decrypted={decryptedById[openRow.submissionId]}
                error={errorById[openRow.submissionId]}
                isPending={pendingIds.has(openRow.submissionId)}
                canDecrypt={canDecrypt}
                onDecrypt={() => onDecrypt(openRow)}
                fields={fields}
                network={network}
                index={openIndex}
                total={rows.length}
                onPrev={openIndex > 0 ? goPrev : undefined}
                onNext={openIndex >= 0 && openIndex < rows.length - 1 ? goNext : undefined}
                onClose={() => setOpenId(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
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
  index: number;
  total: number;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
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
  index,
  total,
  onPrev,
  onNext,
  onClose,
}: SubmissionDetailProps) {
  const submittedDate = new Date(row.submittedAtMs);
  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(row.submissionId);
      toast.success('Submission ID copied');
    } catch {
      toast.error('Clipboard unavailable');
    }
  };

  // Show every question — including unanswered ones — so the dialog reads like
  // a completed Google Forms response (number, label, answer in a card).
  const inputFields = fields;

  return (
    <div className="flex max-h-[90vh] flex-col">
      <DialogHeader className="bg-muted/30 flex-shrink-0 gap-3 border-b px-6 py-4">
        <div className="flex items-center justify-between gap-2">
          <DialogTitle className="text-base">Response {index + 1}</DialogTitle>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs tabular-nums">
              {index + 1} of {total}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={!onPrev}
              onClick={onPrev}
              aria-label="Previous response"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={!onNext}
              onClick={onNext}
              aria-label="Next response"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MetaItem icon={User} label="Submitter">
            <code className="font-mono text-xs">{shortAddr(row.submitter)}</code>
          </MetaItem>
          <MetaItem icon={Calendar} label="Submitted">
            <span className="text-xs">
              {submittedDate.toLocaleDateString()}{' '}
              <span className="text-muted-foreground">{submittedDate.toLocaleTimeString()}</span>
            </span>
          </MetaItem>
          <MetaItem icon={Hash} label="Submission">
            <button
              type="button"
              onClick={() => void handleCopyId()}
              className="hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
              title="Copy submission ID"
            >
              <code className="font-mono">{shortAddr(row.submissionId)}</code>
              <Copy className="h-3 w-3" />
            </button>
          </MetaItem>
        </div>

        <DialogDescription className="sr-only">
          Full response from {shortAddr(row.submitter)} submitted at{' '}
          {submittedDate.toLocaleString()}.
        </DialogDescription>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <a
            href={suivisionUrl(network, 'object', row.submissionId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            View on explorer
          </a>
          {decrypted && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Decrypted
            </span>
          )}
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!decrypted && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Lock className="text-muted-foreground h-8 w-8" />
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">Response is encrypted</h3>
                <p className="text-muted-foreground max-w-sm text-xs">
                  Decrypt this submission to view the submitter&apos;s answers. Your Seal session
                  unlocks it without another wallet prompt after the first decrypt.
                </p>
              </div>
              <Button onClick={onDecrypt} disabled={isPending || !canDecrypt}>
                {isPending ? (
                  <Spinner className="mr-1.5 size-3.5" />
                ) : (
                  <Lock className="mr-1.5 h-3.5 w-3.5" />
                )}
                Decrypt response
              </Button>
              {error && <p className="text-destructive text-xs">{error}</p>}
            </CardContent>
          </Card>
        )}

        {decrypted && (
          <div className="flex flex-col gap-3">
            {inputFields.map((f, i) => (
              <QuestionCard
                key={f.id}
                index={i + 1}
                field={f}
                value={decrypted[f.id]}
              />
            ))}
            {inputFields.length === 0 && (
              <p className="text-muted-foreground py-6 text-center text-sm">
                This form has no input questions.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      {children}
    </div>
  );
}

