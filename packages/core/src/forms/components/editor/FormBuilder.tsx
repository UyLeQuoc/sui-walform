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
import { FieldPaletteSidebar } from './FieldPaletteSidebar';
import { FormBuilderDragOverlay } from './FormBuilderDragOverlay';
import { FormBuilderHeader } from './FormBuilderHeader';
import { FormCard } from './FormCard';
import { RightSidebar } from './RightSidebar';

interface FormBuilderProps {
  /** ID of the form currently loaded in the store. */
  formId: string;
  /** Preserved from IndexedDB so auto-save can write it back correctly. */
  createdAt: number;
  /** Rev observed at hydrate time — drives auto-save's CAS. */
  initialRev: number;
}

export function FormBuilder({ formId, createdAt, initialRev }: FormBuilderProps) {
  const title = useFormBuilderStore((s) => s.schema.title);
  useDocumentTitle(title || 'Untitled form');
  const fontFamily = useFormBuilderStore((s) => s.schema.settings.fontFamily);
  const borderRadius = useFormBuilderStore((s) => s.schema.settings.borderRadius);
  const primaryColor = useFormBuilderStore((s) => s.schema.settings.primaryColor);
  const past = useFormBuilderStore((s) => s.past);
  const future = useFormBuilderStore((s) => s.future);
  const undo = useFormBuilderStore((s) => s.undo);
  const redo = useFormBuilderStore((s) => s.redo);
  const clearSelection = useFormBuilderStore((s) => s.clearSelection);

  const { saveStatus } = useAutoSave({ formId, createdAt, initialRev });
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
  const handleOpenAiGenerate = useCallback(() => setAiOpen(true), []);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

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
        onOpenAiGenerate={handleOpenAiGenerate}
      />

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
