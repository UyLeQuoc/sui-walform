'use client';

import { FileText, Plus, Store } from 'lucide-react';
import { Button } from '../../../ui/button';
import type { useForms } from '../../hooks/use-forms';
import type { OnChainForm, OnChainTemplate } from '../../hooks/use-on-chain-forms';
import { FormCard } from './FormCard';
import { OnChainFormCard } from './OnChainFormCard';
import { TemplateCard } from './TemplateCard';
import { EmptyState, ErrorState, GridSkeleton } from './list-shared';

type UseFormsReturn = ReturnType<typeof useForms>;

interface DraftsBodyProps {
  isLoading: boolean;
  error: UseFormsReturn['error'];
  forms: UseFormsReturn['forms'];
  onDelete: (id: string) => Promise<void>;
  onCreate: () => Promise<void>;
  isCreating: boolean;
  onRetry: () => void;
}

export function DraftsBody({
  isLoading,
  error,
  forms,
  onDelete,
  onCreate,
  isCreating,
  onRetry,
}: DraftsBodyProps) {
  if (isLoading) return <GridSkeleton />;
  if (error !== null) return <ErrorState message={error.message} onRetry={onRetry} />;
  if (forms.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="text-muted-foreground h-8 w-8" />}
        title="No drafts yet"
        description="Create your first form to get started."
        action={
          <Button onClick={() => void onCreate()} disabled={isCreating}>
            <Plus className="mr-2 h-4 w-4" />
            Create form
          </Button>
        }
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {forms.map((form) => (
        <FormCard key={form.id} form={form} onDelete={onDelete} />
      ))}
    </div>
  );
}

interface OnChainFormsBodyProps {
  isLoading: boolean;
  error: Error | null;
  items: OnChainForm[];
  emptyTitle: string;
  emptyDescription: string;
}

export function OnChainFormsBody({
  isLoading,
  error,
  items,
  emptyTitle,
  emptyDescription,
}: OnChainFormsBodyProps) {
  if (isLoading) return <GridSkeleton />;
  if (error) return <ErrorState message={error.message} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="text-muted-foreground h-8 w-8" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((f) => (
        <OnChainFormCard key={f.formId} form={f} />
      ))}
    </div>
  );
}

interface TemplatesBodyProps {
  isLoading: boolean;
  error: Error | null;
  items: OnChainTemplate[];
}

export function TemplatesBody({ isLoading, error, items }: TemplatesBodyProps) {
  if (isLoading) return <GridSkeleton />;
  if (error) return <ErrorState message={error.message} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Store className="text-muted-foreground h-8 w-8" />}
        title="No listings yet"
        description="Publish a draft to the Marketplace to share or sell it."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((t) => (
        <TemplateCard key={t.templateId} template={t} />
      ))}
    </div>
  );
}
