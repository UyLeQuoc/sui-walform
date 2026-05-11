'use client';

import { ArrowLeft, Eye, History, Redo2, Settings2, Sparkles, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../../../ui/button';
import type { SaveStatus } from '../../hooks/use-auto-save';
import type { RightSidebarMode } from '../../hooks/use-right-sidebar-mode';
import { EditorPublishButton } from './EditorPublishButton';
import { ExportButton } from './ExportButton';
import { SaveStatusBadge } from './SaveStatusBadge';
import { ThemeToggle } from './ThemeToggle';

interface FormBuilderHeaderProps {
  formId: string;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  rightMode: RightSidebarMode;
  onToggleHistory: () => void;
  onToggleSettings: () => void;
  onOpenAiGenerate: () => void;
}

export function FormBuilderHeader({
  formId,
  saveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  rightMode,
  onToggleHistory,
  onToggleSettings,
  onOpenAiGenerate,
}: FormBuilderHeaderProps) {
  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 z-20 border-b backdrop-blur">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild className="gap-1.5">
            <Link href="/forms">
              <ArrowLeft className="h-4 w-4" />
              Forms
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <SaveStatusBadge status={saveStatus} />
          <Button variant="outline" onClick={onOpenAiGenerate} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Generate with AI
          </Button>
          <Button variant="outline" size="icon" onClick={onUndo} disabled={!canUndo}>
            <Undo2 />
            <span className="sr-only">Undo</span>
          </Button>
          <Button variant="outline" size="icon" onClick={onRedo} disabled={!canRedo}>
            <Redo2 />
            <span className="sr-only">Redo</span>
          </Button>

          <Button
            variant={rightMode === 'history' ? 'default' : 'outline'}
            size="icon"
            aria-label="History"
            aria-pressed={rightMode === 'history'}
            onClick={onToggleHistory}
          >
            <History className="h-4 w-4" />
          </Button>

          <Button
            variant={rightMode === 'settings' ? 'default' : 'outline'}
            size="icon"
            aria-label="Form settings"
            aria-pressed={rightMode === 'settings'}
            onClick={onToggleSettings}
          >
            <Settings2 className="h-4 w-4" />
          </Button>

          <ThemeToggle />
          <ExportButton />

          <Button variant="outline" asChild>
            <Link href={`/forms/${formId}/preview`}>
              <Eye className="h-4 w-4" />
              Preview
            </Link>
          </Button>

          <EditorPublishButton formId={formId} />
        </div>
      </div>
    </header>
  );
}
