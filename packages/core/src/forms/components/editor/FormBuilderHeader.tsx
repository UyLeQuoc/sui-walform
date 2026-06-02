'use client';

import { Eye, History, Redo2, Settings, Sparkles, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NetworkBadge, WalletButton } from '../../../sui/wallet-ui';
import { Button } from '../../../ui/button';
import { ButtonGroup } from '../../../ui/button-group';
import { Kbd, KbdGroup } from '../../../ui/kbd';
import { Logo } from '../../../ui/logo';
import { Separator } from '../../../ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../ui/tooltip';
import type { SaveStatus } from '../../hooks/use-auto-save';
import type { RightSidebarMode } from '../../hooks/use-right-sidebar-mode';
import { formsRoute } from '../../lib/routes';
import { useFormBuilderStore } from '../../store/form-builder-store';
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
  const title = useFormBuilderStore((s) => s.schema.title);

  return (
    <TooltipProvider delayDuration={200}>
      <header className="bg-background/95 supports-backdrop-filter:bg-background/60 z-20 border-b backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/forms"
                  aria-label="Back to forms"
                  className="hover:bg-muted flex size-9 items-center justify-center rounded-full transition-colors"
                >
                  <Logo className="size-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">Back to forms</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="!h-5" />

            <div className="flex min-w-0 items-center gap-2">
              <span
                className="text-foreground truncate text-sm font-medium"
                title={title || 'Untitled form'}
              >
                {title || 'Untitled form'}
              </span>
              <SaveStatusBadge status={saveStatus} />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={onOpenAiGenerate} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate with AI
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Draft fields from a prompt</TooltipContent>
            </Tooltip>

            <ButtonGroup>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onUndo}
                    disabled={!canUndo}
                    aria-label="Undo"
                  >
                    <Undo2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Undo
                  <KbdGroup>
                    <Kbd>⌘</Kbd>
                    <Kbd>Z</Kbd>
                  </KbdGroup>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onRedo}
                    disabled={!canRedo}
                    aria-label="Redo"
                  >
                    <Redo2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Redo
                  <KbdGroup>
                    <Kbd>⇧</Kbd>
                    <Kbd>⌘</Kbd>
                    <Kbd>Z</Kbd>
                  </KbdGroup>
                </TooltipContent>
              </Tooltip>
            </ButtonGroup>

            <ButtonGroup>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={rightMode === 'history' ? 'default' : 'outline'}
                    size="icon"
                    aria-label="History"
                    aria-pressed={rightMode === 'history'}
                    onClick={onToggleHistory}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">History</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={rightMode === 'settings' ? 'default' : 'outline'}
                    size="icon"
                    aria-label="Form settings"
                    aria-pressed={rightMode === 'settings'}
                    onClick={onToggleSettings}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Form settings</TooltipContent>
              </Tooltip>
            </ButtonGroup>

            <Separator orientation="vertical" className="mx-1 !h-5" />

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <ThemeToggle />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle theme</TooltipContent>
            </Tooltip>
            <ExportButton />

            <Button variant="outline" asChild className="gap-1.5">
              <Link to={formsRoute.preview(formId)}>
                <Eye className="h-4 w-4" />
                Preview
              </Link>
            </Button>

            <EditorPublishButton formId={formId} />
            <NetworkBadge />
            <WalletButton />
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}
