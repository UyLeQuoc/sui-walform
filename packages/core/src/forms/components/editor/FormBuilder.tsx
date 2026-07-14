'use client';

import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { useCallback, useMemo, useState } from 'react';
import { useAutoSave } from '../../hooks/use-auto-save';
import { useDocumentTitle } from '../../hooks/use-document-title';
import { useEditorShortcuts } from '../../hooks/use-editor-shortcuts';
import { useFormBuilderDnd } from '../../hooks/use-form-builder-dnd';
import { useMounted } from '../../hooks/use-mounted';
import { useRightSidebarMode } from '../../hooks/use-right-sidebar-mode';
import { buildFormAreaStyle } from '../../lib/form-appearance';
import { getFormFont } from '../../lib/form-fonts';
import { useFormBuilderStore } from '../../store/form-builder-store';
import { AiGenerateDialog } from './AiGenerateDialog';
import { CanvasViewport } from './CanvasViewport';
import { ClonedFromBanner } from './ClonedFromBanner';
import { useCollab } from './CollabProvider';
import { FieldPaletteSidebar } from './FieldPaletteSidebar';
import { FormBuilderDragOverlay } from './FormBuilderDragOverlay';
import { FormBuilderHeader } from './FormBuilderHeader';
import { FormCard } from './FormCard';
import { RightSidebar } from './RightSidebar';
import type { StoredForm } from '../../../types';

interface FormBuilderProps {
  /** ID of the form currently loaded in the store. */
  formId: string;
  /** Preserved from IndexedDB so auto-save can write it back correctly. */
  createdAt: number;
  /** Rev observed at hydrate time — drives auto-save's CAS. */
  initialRev: number;
  /** Marketplace template provenance, when draft was cloned via useCloneTemplateToDraft. */
  sourceTemplate?: StoredForm['sourceTemplate'];
  /**
   * Persist the store to IndexedDB on a debounce. Off for a *joined* collab
   * session — an invitee has no local draft and the Y doc lives on the server,
   * so writing to their IDB would pollute their Drafts list (see COLLAB_DESIGN §6).
   */
  autoSave?: boolean;
  /**
   * Present when editing an already-published on-chain form. Swaps the header's
   * Publish button for an Update button (writes via `update_schema`) and shows a
   * banner. Auto-save is off in this mode — chain is the source of truth.
   */
  onChainEdit?: { formObjectId: string; submissionCount: number };
}

export function FormBuilder({
  formId,
  createdAt,
  initialRev,
  sourceTemplate,
  autoSave = true,
  onChainEdit,
}: FormBuilderProps) {
  const title = useFormBuilderStore((s) => s.schema.title);
  useDocumentTitle(title || 'Untitled form');
  const fontFamily = useFormBuilderStore((s) => s.schema.settings.fontFamily);
  const borderRadius = useFormBuilderStore((s) => s.schema.settings.borderRadius);
  const primaryColor = useFormBuilderStore((s) => s.schema.settings.primaryColor);
  const past = useFormBuilderStore((s) => s.past);
  const future = useFormBuilderStore((s) => s.future);
  const storeUndo = useFormBuilderStore((s) => s.undo);
  const storeRedo = useFormBuilderStore((s) => s.redo);
  const collabActive = useFormBuilderStore((s) => s.collabActive);
  const clearSelection = useFormBuilderStore((s) => s.clearSelection);
  const collab = useCollab();
  const undo = collabActive ? collab.undo : storeUndo;
  const redo = collabActive ? collab.redo : storeRedo;

  const { saveStatus } = useAutoSave({ formId, createdAt, initialRev, enabled: autoSave });
  const mounted = useMounted();
  const { mode: rightMode, toggle: toggleRightMode, resetToAuto } = useRightSidebarMode();

  const dnd = useFormBuilderDnd();

  const [aiOpen, setAiOpen] = useState(false);

  const onEscape = useCallback(() => {
    clearSelection();
    resetToAuto();
  }, [clearSelection, resetToAuto]);

  useEditorShortcuts({
    onUndo: undo,
    onRedo: redo,
    onEscape,
  });

  const formAreaStyle = useMemo(() => {
    const formFont = getFormFont(fontFamily);
    return buildFormAreaStyle(formFont.fontFamily, borderRadius ?? 4, primaryColor ?? 'default');
  }, [fontFamily, borderRadius, primaryColor]);

  const handleToggleHistory = useCallback(() => toggleRightMode('history'), [toggleRightMode]);
  const handleToggleSettings = useCallback(() => toggleRightMode('settings'), [toggleRightMode]);
  // Opening the panel is purely a UI toggle — it must NOT start a session. The
  // session begins only when a share token lands in the URL ("Start
  // collaboration"), so an unshared draft stays local and keeps its undo stack.
  const handleToggleCollab = useCallback(() => toggleRightMode('collaboration'), [toggleRightMode]);
  const handleOpenAiGenerate = useCallback(() => setAiOpen(true), []);

  const canUndo = collabActive ? collab.canUndo : past.length > 0;
  const canRedo = collabActive ? collab.canRedo : future.length > 0;

  if (!mounted) {
    return <div className="bg-muted/30 min-h-screen animate-pulse" />;
  }

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      <FormBuilderHeader
        formId={formId}
        saveStatus={saveStatus}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        rightMode={rightMode}
        onToggleHistory={handleToggleHistory}
        onToggleSettings={handleToggleSettings}
        onToggleCollab={handleToggleCollab}
        onOpenAiGenerate={handleOpenAiGenerate}
        onChainEdit={onChainEdit}
      />

      {onChainEdit && onChainEdit.submissionCount > 0 && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-400">
          Editing a published form with {onChainEdit.submissionCount}{' '}
          {onChainEdit.submissionCount === 1 ? 'response' : 'responses'} — removing or retyping
          existing fields can orphan response data in Results. Adding new fields is safe.
        </div>
      )}

      {sourceTemplate && (
        <ClonedFromBanner formId={formId} sourceTemplate={sourceTemplate} />
      )}

      <DndContext
        sensors={dnd.sensors}
        collisionDetection={closestCenter}
        onDragStart={dnd.handleDragStart}
        onDragOver={dnd.handleDragOver}
        onDragEnd={dnd.handleDragEnd}
        onDragCancel={dnd.handleDragCancel}
      >
        <div className="flex flex-1 overflow-hidden">
          <FieldPaletteSidebar />

          <CanvasViewport suppressDeselect={!!dnd.activeDrag}>
            <FormCard
              formAreaStyle={formAreaStyle}
              paletteDropIndex={dnd.paletteDropIndex}
              isPaletteDragging={dnd.isPaletteDragging}
            />
          </CanvasViewport>

          <RightSidebar mode={rightMode} onClose={resetToAuto} />
        </div>

        <AiGenerateDialog open={aiOpen} onOpenChange={setAiOpen} />

        <DragOverlay dropAnimation={null}>
          <FormBuilderDragOverlay
            activeField={dnd.activeField}
            activeOutlineField={dnd.activeOutlineField}
            activePaletteMeta={dnd.activePaletteMeta}
          />
        </DragOverlay>
      </DndContext>
    </div>
  );
}
