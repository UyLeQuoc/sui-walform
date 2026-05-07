'use client';

import { Button } from '../../../../ui/button';
import { Field, FieldLabel } from '../../../../ui/field';
import { Input } from '../../../../ui/input';
import { useFormBuilderStore } from '../../../store/form-builder-store';
import type { FormField, FormFieldOption } from '../../../../types';
import { useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, Plus, SquareDashed, Trash2 } from 'lucide-react';

interface SortableOptionRowProps {
  option: FormFieldOption;
  isDefault: boolean;
  onToggleDefault: () => void;
  onLabelChange: (label: string) => void;
  onRemove: () => void;
}

function SortableOptionRow({
  option,
  isDefault,
  onToggleDefault,
  onLabelChange,
  onRemove,
}: SortableOptionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
      className="group/option flex items-center gap-1.5"
    >
      <Button
        ref={setActivatorNodeRef}
        variant="ghost"
        size="icon"
        {...attributes}
        {...listeners}
        className="text-muted-foreground shrink-0 cursor-grab transition-opacity active:cursor-grabbing"
      >
        <GripVertical />
        <span className="sr-only">Drag to reorder</span>
      </Button>
      <Input
        value={option.label}
        onChange={(e) => onLabelChange(e.target.value)}
        placeholder="Option label"
        className="flex-1"
      />
      <Button
        variant={'ghost'}
        size="icon"
        onClick={onToggleDefault}
        className={isDefault ? 'shrink-0' : 'shrink-0 transition-opacity'}
      >
        {isDefault ? <Check /> : <SquareDashed />}
        <span className="sr-only">{isDefault ? 'Remove default' : 'Set as default'}</span>
      </Button>
      <Button variant="ghost" size="icon" onClick={onRemove} className="shrink-0">
        <Trash2 />
        <span className="sr-only">Remove option</span>
      </Button>
    </div>
  );
}

interface OptionsEditorProps {
  field: FormField;
}

export function OptionsEditor({ field }: OptionsEditorProps) {
  const updateField = useFormBuilderStore((s) => s.updateField);
  const updateFieldDeferred = useFormBuilderStore((s) => s.updateFieldDeferred);
  const options = field.options ?? [];
  const isMultiple = field.type === 'multiple_choice';
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeOption = options.find((o) => o.id === activeId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const isDefault = (optValue: string) => {
    if (isMultiple) return (field.defaultValues ?? []).includes(optValue);
    return field.defaultValue === optValue;
  };

  const handleToggleDefault = (optValue: string) => {
    if (isMultiple) {
      const current = field.defaultValues ?? [];
      updateField(field.id, {
        defaultValues: current.includes(optValue)
          ? current.filter((v) => v !== optValue)
          : [...current, optValue],
      });
    } else {
      updateField(field.id, {
        defaultValue: field.defaultValue === optValue ? undefined : optValue,
      });
    }
  };

  const handleAdd = () => {
    const n = options.length + 1;
    const newOption: FormFieldOption = {
      id: crypto.randomUUID(),
      label: `Option ${n}`,
      value: `option_${n}`,
    };
    updateField(field.id, { options: [...options, newOption] });
  };

  const handleLabelChange = (optionId: string, label: string) => {
    updateFieldDeferred(field.id, {
      options: options.map((o) =>
        o.id === optionId
          ? {
              ...o,
              label,
              value: label.toLowerCase().replace(/\s+/g, '_') || o.value,
            }
          : o,
      ),
    });
  };

  const handleRemove = (optionId: string) => {
    const opt = options.find((o) => o.id === optionId);
    const updates: Partial<FormField> = {
      options: options.filter((o) => o.id !== optionId),
    };
    if (opt) {
      if (!isMultiple && field.defaultValue === opt.value) updates.defaultValue = undefined;
      if (isMultiple && (field.defaultValues ?? []).includes(opt.value))
        updates.defaultValues = (field.defaultValues ?? []).filter((v) => v !== opt.value);
    }
    updateField(field.id, updates);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = options.findIndex((o) => o.id === active.id);
    const toIndex = options.findIndex((o) => o.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const reordered = [...options];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved!);
    updateField(field.id, { options: reordered });
  };

  return (
    <Field>
      <FieldLabel>Options</FieldLabel>
      <div className="flex flex-col gap-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={options.map((o) => o.id)} strategy={verticalListSortingStrategy}>
            {options.map((option) => (
              <SortableOptionRow
                key={option.id}
                option={option}
                isDefault={isDefault(option.value)}
                onToggleDefault={() => handleToggleDefault(option.value)}
                onLabelChange={(label) => handleLabelChange(option.id, label)}
                onRemove={() => handleRemove(option.id)}
              />
            ))}
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {activeOption ? (
              <div className="bg-background flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground shrink-0 cursor-grabbing"
                >
                  <GripVertical />
                </Button>
                <div className="border-muted flex-1 truncate rounded-lg border px-2.5 py-1">
                  {activeOption.label}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        <Button variant="outline" onClick={handleAdd}>
          <Plus data-icon="inline-start" />
          Add option
        </Button>
      </div>
    </Field>
  );
}
