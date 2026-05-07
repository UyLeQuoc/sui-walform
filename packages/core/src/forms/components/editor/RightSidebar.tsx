'use client';

import { Sliders, X } from 'lucide-react';
import { Button } from '../../../ui/button';
import { ScrollArea } from '../../../ui/scroll-area';
import { cn } from '../../../lib/utils';
import type { RightSidebarMode } from '../../hooks/use-right-sidebar-mode';
import { useFormBuilderStore } from '../../store/form-builder-store';
import { CoverImageSettingsPanel } from './CoverImageSettingsPanel';
import { FieldSettings } from './FieldSettings';
import { FormOverview } from './FormOverview';
import { FormSettingsPanel } from './FormSettingsPanel';
import { HistoryPanel } from './HistoryPanel';
import { SubmitSettingsPanel } from './SubmitSettingsPanel';

export type { RightSidebarMode };

interface RightSidebarProps {
  mode: RightSidebarMode;
  onClose: () => void;
}

/**
 * The right column shown next to the canvas. Five display states:
 *   - `history`:  pinned history view (header toggle).
 *   - `settings`: pinned form-wide appearance panel (header toggle).
 *   - `auto` + a selected field:   field properties panel.
 *   - `auto` + submit selected:    submit-button properties panel.
 *   - `auto` + nothing selected:   form outline / overview.
 */
export function RightSidebar({ mode, onClose }: RightSidebarProps) {
  const selectedFieldId = useFormBuilderStore((s) => s.selectedFieldId);
  const isSubmitSelected = useFormBuilderStore((s) => s.isSubmitSelected);
  const isCoverSelected = useFormBuilderStore((s) => s.isCoverSelected);

  return (
    <aside
      className={cn(
        'bg-background/80 supports-backdrop-filter:bg-background/60 flex h-full w-[300px] shrink-0 flex-col border-l backdrop-blur',
      )}
      aria-label="Right sidebar"
    >
      {mode === 'history' ? (
        <SidebarPane
          eyebrow="Change history"
          subtitle="Click an entry to jump to that state."
          onClose={onClose}
        >
          <HistoryPanel />
        </SidebarPane>
      ) : mode === 'settings' ? (
        <SidebarPane
          eyebrow="Form settings"
          subtitle="Typography, radius, and primary color."
          icon={<Sliders className="text-muted-foreground h-3.5 w-3.5" />}
          onClose={onClose}
        >
          <ScrollArea className="h-full">
            <div className="px-4 py-4">
              <FormSettingsPanel />
            </div>
          </ScrollArea>
        </SidebarPane>
      ) : selectedFieldId ? (
        <FieldSettings />
      ) : isSubmitSelected ? (
        <SubmitSettingsPanel />
      ) : isCoverSelected ? (
        <CoverImageSettingsPanel />
      ) : (
        <FormOverview />
      )}
    </aside>
  );
}

interface SidebarPaneProps {
  eyebrow: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}

function SidebarPane({ eyebrow, subtitle, icon, onClose, children }: SidebarPaneProps) {
  return (
    <>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {icon}
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {eyebrow}
            </p>
          </div>
          {subtitle && <p className="text-muted-foreground/80 mt-0.5 text-xs">{subtitle}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Close ${eyebrow.toLowerCase()}`}
          onClick={onClose}
          className="h-7 w-7"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </>
  );
}
