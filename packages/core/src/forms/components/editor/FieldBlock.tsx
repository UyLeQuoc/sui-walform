/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
'use client';

import { EditorContent } from '@tiptap/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { memo, useCallback, useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { useFieldLabelEditor } from '../../hooks/use-field-label-editor';
import { useInlineLabelEditor } from '../../hooks/use-inline-label-editor';
import { useFocusPeer } from '../../hooks/use-presence';
import {
  HEADING_CLASSES,
  TEXT_ALIGN_CLASSES,
  buildInlineTextStyle,
} from '../../lib/inline-text-style';
import { peerLabel } from '../../lib/collab-identity';
import { useFormBuilderStore } from '../../store/form-builder-store';
import type { FormField, PresencePeer } from '../../../types';
import { useCollab } from './CollabProvider';
import { PeerAvatar } from './PeerAvatar';
import { FieldEditPreview } from './FieldEditPreview';
import { FieldTypeIcon } from '../FieldTypeIcon';
import { MarkdownField } from '../fields/MarkdownField';
import { SlashCommandMenu } from './SlashCommandMenu';

interface FieldBlockProps {
  field: FormField;
  index: number;
  /** 1-based ordinal among input fields on this page; null for layout
   * blocks (heading, description, markdown, divider, space). When provided,
   * a muted-foreground "1." prefix is rendered before the type icon. */
  questionNumber?: number | null;
}

interface CanvasBlockShellProps {
  field: FormField;
  isSelected: boolean;
  isDragging: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  style: React.CSSProperties;
}

/**
 * Stops pointerdown/click bubbling so dnd-kit's PointerSensor (listening
 * on the outer block wrapper) doesn't treat clicks on the inline TipTap
 * editor as the start of a drag. Without this, typing into the label —
 * or drag-selecting text — would initiate a sortable drag after 5px of
 * movement and steal input from the editor.
 */
const stopDragActivation = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onClick: (e: React.MouseEvent) => e.stopPropagation(),
};

const BLOCK_WRAPPER_CLASS =
  'hover:bg-accent/40 relative cursor-grab rounded-md px-3 py-2 transition-colors select-none active:cursor-grabbing';

const BLOCK_SELECTED_CLASS =
  'bg-accent/40 ring-primary/50 ring-offset-card ring-[3px] ring-offset-2';

const INLINE_EDITOR_CLASS = cn(
  'inline-block w-fit min-w-4 cursor-text select-text',
  '[&_.tiptap]:inline-block [&_.tiptap]:w-fit [&_.tiptap]:min-w-4 [&_.tiptap]:outline-none',
  '[&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground/60',
  '[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none',
  '[&_.tiptap_p.is-editor-empty:first-child::before]:float-left',
  '[&_.tiptap_p.is-editor-empty:first-child::before]:h-0',
  '[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
);

const LABEL_EDITOR_CLASS =
  '[&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground min-w-4 cursor-text select-text [&_.tiptap]:inline-block [&_.tiptap]:min-w-4 [&_.tiptap]:text-sm [&_.tiptap]:font-medium [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]';

const INLINE_HELPER_CLASS = 'text-muted-foreground text-sm leading-relaxed';

/**
 * Inline heading / description block — bare TipTap editor with no
 * type-icon row, no hover gutter. Selection and reorder are driven from
 * the outline; clicking the block selects, clicking text edits inline.
 */
const InlineTextBlock = memo(function InlineTextBlock({
  field,
  isSelected,
  isDragging,
  setNodeRef,
  setActivatorNodeRef,
  attributes,
  listeners,
  style,
}: CanvasBlockShellProps) {
  const setSelectedFieldId = useFormBuilderStore((s) => s.setSelectedFieldId);
  const updateFieldLabel = useFormBuilderStore((s) => s.updateFieldLabel);

  const isHeading = field.type === 'heading';
  const level = field.headingLevel ?? 'h2';
  const align = field.textAlign ?? 'left';
  const layoutStyle = useMemo(() => buildInlineTextStyle(field), [field]);

  const onLabelUpdate = useCallback(
    (text: string) => updateFieldLabel(field.id, text),
    [updateFieldLabel, field.id],
  );

  const editor = useInlineLabelEditor({
    value: field.label,
    placeholder: isHeading ? 'Heading' : 'Add a description…',
    onUpdate: onLabelUpdate,
  });

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setActivatorNodeRef(node);
    },
    [setNodeRef, setActivatorNodeRef],
  );

  const handleSelect = useCallback(
    () => setSelectedFieldId(field.id),
    [setSelectedFieldId, field.id],
  );

  return (
    <div
      ref={setRefs}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleSelect}
      className={cn(
        BLOCK_WRAPPER_CLASS,
        isSelected && BLOCK_SELECTED_CLASS,
        isDragging && 'opacity-40',
      )}
    >
      <div className={cn('leading-tight', TEXT_ALIGN_CLASSES[align])} style={layoutStyle}>
        <EditorContent
          editor={editor}
          {...stopDragActivation}
          className={cn(
            INLINE_EDITOR_CLASS,
            isHeading ? HEADING_CLASSES[level] : INLINE_HELPER_CLASS,
          )}
        />
      </div>
    </div>
  );
});

const MarkdownCanvasBlock = memo(function MarkdownCanvasBlock({
  field,
  isSelected,
  isDragging,
  setNodeRef,
  setActivatorNodeRef,
  attributes,
  listeners,
  style,
}: CanvasBlockShellProps) {
  const setSelectedFieldId = useFormBuilderStore((s) => s.setSelectedFieldId);

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setActivatorNodeRef(node);
    },
    [setNodeRef, setActivatorNodeRef],
  );

  const handleSelect = useCallback(
    () => setSelectedFieldId(field.id),
    [setSelectedFieldId, field.id],
  );

  return (
    <div
      ref={setRefs}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleSelect}
      className={cn(
        BLOCK_WRAPPER_CLASS,
        isSelected && BLOCK_SELECTED_CLASS,
        isDragging && 'opacity-40',
      )}
    >
      {field.label ? (
        <div className="pointer-events-none">
          <MarkdownField field={field} />
        </div>
      ) : (
        <p className="text-muted-foreground/50 px-3 py-2 text-sm italic">
          Write markdown content in the settings panel…
        </p>
      )}
    </div>
  );
});

function RemoteFocusOverlay({ peer }: { peer: PresencePeer }) {
  const label = peerLabel(peer.user.address, peer.user.name);
  return (
    <>
      {/* "currently being edited by …" banner sitting on the top border line */}
      <span
        className="pointer-events-none absolute -top-2.5 left-3 z-20 max-w-[75%] truncate rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-sm"
        style={{ backgroundColor: peer.user.color }}
      >
        This field is being edited by {label}
      </span>
      {/* Avatar tucked flush into the top-right corner, ringed in the peer's color */}
      <PeerAvatar
        address={peer.user.address}
        size="sm"
        title={label}
        className="pointer-events-none absolute top-0 right-0 z-20"
        style={{ boxShadow: `0 0 0 2px ${peer.user.color}` }}
      />
    </>
  );
}

function FieldBlockImpl({ field, index, questionNumber }: FieldBlockProps) {
  const selectedFieldId = useFormBuilderStore((s) => s.selectedFieldId);
  const setSelectedFieldId = useFormBuilderStore((s) => s.setSelectedFieldId);
  const isSelected = selectedFieldId === field.id;
  const { awareness } = useCollab();
  const remotePeer = useFocusPeer(awareness, field.id);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setActivatorNodeRef(node);
    },
    [setNodeRef, setActivatorNodeRef],
  );

  const style = useMemo<React.CSSProperties>(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
    }),
    [transform, transition],
  );

  const handleSelect = useCallback(
    () => setSelectedFieldId(field.id),
    [setSelectedFieldId, field.id],
  );

  const { editor, showSlash, handleSlashSelect, closeSlash } = useFieldLabelEditor({
    fieldId: field.id,
    initialLabel: field.label,
    index,
  });

  if (field.type === 'heading' || field.type === 'description') {
    return (
      <InlineTextBlock
        field={field}
        isSelected={isSelected}
        isDragging={isDragging}
        setNodeRef={setNodeRef}
        setActivatorNodeRef={setActivatorNodeRef}
        attributes={attributes}
        listeners={listeners}
        style={style}
      />
    );
  }

  if (field.type === 'markdown') {
    return (
      <MarkdownCanvasBlock
        field={field}
        isSelected={isSelected}
        isDragging={isDragging}
        setNodeRef={setNodeRef}
        setActivatorNodeRef={setActivatorNodeRef}
        attributes={attributes}
        listeners={listeners}
        style={style}
      />
    );
  }

  if (field.type === 'divider' || field.type === 'space') {
    return (
      <div
        ref={setRefs}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleSelect}
        className={cn(
          BLOCK_WRAPPER_CLASS,
          isSelected && BLOCK_SELECTED_CLASS,
          isDragging && 'opacity-40',
        )}
      >
        <FieldEditPreview field={field} />
      </div>
    );
  }

  return (
    <div
      ref={setRefs}
      style={
        remotePeer
          ? { ...style, outline: `2px solid ${remotePeer.user.color}`, outlineOffset: 2 }
          : style
      }
      {...attributes}
      {...listeners}
      onClick={handleSelect}
      className={cn(
        BLOCK_WRAPPER_CLASS,
        isSelected && BLOCK_SELECTED_CLASS,
        isDragging && 'opacity-40',
        remotePeer && 'relative',
      )}
    >
      {remotePeer && <RemoteFocusOverlay peer={remotePeer} />}
      {/* Label row */}
      <div className="relative flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0">
        {questionNumber != null && (
          <span
            aria-hidden
            className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums select-none"
          >
            {questionNumber}.
          </span>
        )}
        <FieldTypeIcon type={field.type} className="text-muted-foreground/50 mr-1 shrink-0" />
        <EditorContent editor={editor} {...stopDragActivation} className={LABEL_EDITOR_CLASS} />
        {field.required && (
          <span className="text-destructive shrink-0 text-sm leading-none">*</span>
        )}

        {showSlash && <SlashCommandMenu onSelect={handleSlashSelect} onClose={closeSlash} />}
      </div>

      {/* Help text */}
      {field.helpText && (
        <p className="text-muted-foreground mt-0.5 pl-0 text-xs">{field.helpText}</p>
      )}

      {/* Disabled field preview */}
      <div className="pl-0">
        <FieldEditPreview field={field} />
      </div>
    </div>
  );
}

export const FieldBlock = memo(FieldBlockImpl);
