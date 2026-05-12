import { create } from 'zustand';
import { DEFAULT_CODE_LANGUAGE } from '../lib/code-languages';
import { DEFAULT_BORDER_RADIUS, DEFAULT_FORM_COLOR_KEY } from '../lib/form-appearance';
import { DEFAULT_FORM_FONT_KEY } from '../lib/form-fonts';
import { SCHEMA_VERSION } from '../lib/schema-version';
import type {
  FieldType,
  FormField,
  FormSchema,
  FormSettings,
  HistoryEntry,
  StoredForm,
} from '../../types';

// Sentinel schema used only as the store's initial (no-form-loaded) state.
// schema.id === "" signals that no form has been loaded yet.
const EMPTY_SCHEMA: FormSchema = {
  id: '',
  version: SCHEMA_VERSION,
  title: '',
  description: '',
  fields: [],
  settings: {
    submitLabel: 'Submit',
    successMessage: 'Thank you for your response!',
    submitAlignment: 'center',
    fontFamily: DEFAULT_FORM_FONT_KEY,
    borderRadius: DEFAULT_BORDER_RADIUS,
    primaryColor: DEFAULT_FORM_COLOR_KEY,
    displayMode: 'card',
  },
};

const DEFAULT_LABELS = {
  short_text: 'Short Answer',
  long_text: 'Long Answer',
  single_choice: 'Single Choice',
  multiple_choice: 'Multiple Choice',
  number: 'Number',
  date: 'Date',
  select: 'Select',
  linear_scale: 'Linear Scale',
  divider: 'Divider',
  space: 'Space',
  email: 'Email',
  phone: 'Phone Number',
  url: 'Website URL',
  rating: 'Rating',
  time: 'Time',
  yes_no: 'Yes / No',
  heading: 'Section Heading',
  description: 'Add a description…',
  markdown: '**Bold**, *italic*, [links](url), lists…',
  code: 'Code',
  file: 'File',
} as const satisfies Record<FieldType, string>;

function buildDefaultField(type: FieldType): FormField {
  const base: FormField = {
    id: crypto.randomUUID(),
    type,
    label: DEFAULT_LABELS[type],
    required: false,
  };
  if (type === 'single_choice' || type === 'multiple_choice' || type === 'select') {
    return {
      ...base,
      options: [
        { id: crypto.randomUUID(), label: 'Option 1', value: 'Option 1' },
        { id: crypto.randomUUID(), label: 'Option 2', value: 'Option 2' },
      ],
    };
  }
  if (type === 'linear_scale') {
    return { ...base, validation: { scaleFrom: 1, scaleTo: 5, scaleJump: 1 } };
  }
  if (type === 'heading') {
    return { ...base, headingLevel: 'h2' as const, textAlign: 'left' as const };
  }
  if (type === 'description') {
    return { ...base, textAlign: 'left' as const };
  }
  if (type === 'code') {
    return { ...base, codeLanguage: DEFAULT_CODE_LANGUAGE };
  }
  if (type === 'space') {
    return { ...base, height: 32 };
  }
  return base;
}

function pushHistory(past: HistoryEntry[], schema: FormSchema, label: string): HistoryEntry[] {
  return [...past, { schema, label, timestamp: Date.now() }].slice(-50);
}

// Module-level deferred edit state — avoids polluting store with UI-only timers.
let deferredSnapshot: FormSchema | null = null;
let deferredTimer: ReturnType<typeof setTimeout> | null = null;

function cancelDeferred() {
  if (deferredTimer) {
    clearTimeout(deferredTimer);
    deferredTimer = null;
  }
  deferredSnapshot = null;
}

const DEFERRED_COMMIT_MS = 800;

/**
 * Coalesce keystroke-grade edits into a single undo entry. The first edit
 * captures the pre-edit schema; the timer commits a history entry once the
 * user pauses for `DEFERRED_COMMIT_MS`. Inputs that share this pattern (field
 * label, form title/description, field-level updateFieldDeferred) all reuse
 * the same module-level snapshot, so an undo after typing reverts the entire
 * burst instead of one character at a time.
 */
function scheduleDeferredCommit(
  capture: () => FormSchema,
  commit: (snapshot: FormSchema) => void,
): void {
  if (!deferredSnapshot) {
    deferredSnapshot = capture();
  }
  if (deferredTimer) clearTimeout(deferredTimer);
  deferredTimer = setTimeout(() => {
    deferredTimer = null;
    const snapshot = deferredSnapshot;
    deferredSnapshot = null;
    if (!snapshot) return;
    commit(snapshot);
  }, DEFERRED_COMMIT_MS);
}

interface FormBuilderState {
  schema: FormSchema;
  past: HistoryEntry[];
  future: HistoryEntry[];
  currentLabel: string;
  selectedFieldId: string | null;
  /**
   * True when the submit button block is the active selection — mutually
   * exclusive with `selectedFieldId`. The right sidebar keys off this to
   * swap in the submit settings panel.
   */
  isSubmitSelected: boolean;
  /**
   * True when the cover image block is the active selection — mutually
   * exclusive with `selectedFieldId` and `isSubmitSelected`. The right
   * sidebar swaps in the cover image settings panel.
   */
  isCoverSelected: boolean;
  activeMode: 'edit' | 'preview' | 'history';
  /** Timestamp from StoredForm; 0 means no form is loaded. */
  createdAt: number;
}

interface FormBuilderActions {
  /** Populate the store from a stored form (called by FormEditorClient on mount). */
  loadFromDb: (stored: StoredForm) => void;
  addField: (type: FieldType) => void;
  addFieldAt: (type: FieldType, insertAfterIndex: number) => void;
  removeField: (id: string) => void;
  duplicateField: (id: string) => void;
  /** Discrete change (toggle, select, calendar) — pushes history immediately. */
  updateField: (id: string, updates: Partial<FormField>) => void;
  /**
   * Typing input — applies update live, debounces the history push 800 ms
   * after the last call. Only records history if the value changed.
   */
  updateFieldDeferred: (id: string, updates: Partial<FormField>) => void;
  updateFieldLabel: (id: string, label: string) => void;
  reorderFields: (fromIndex: number, toIndex: number) => void;
  updateTitle: (title: string) => void;
  updateDescription: (description: string) => void;
  /**
   * Replace (or remove) the form cover image. Pass a data URL to set it, or
   * `null` to clear it. Pushes history so the change is undoable.
   */
  updateCoverImage: (dataUrl: string | null) => void;
  updateSettings: (updates: Partial<FormSettings>) => void;
  undo: () => void;
  redo: () => void;
  jumpToHistory: (combinedIndex: number) => void;
  setSelectedFieldId: (id: string | null) => void;
  setIsSubmitSelected: (selected: boolean) => void;
  setIsCoverSelected: (selected: boolean) => void;
  /** Clear field, submit, and cover selection in one call. */
  clearSelection: () => void;
  setActiveMode: (mode: 'edit' | 'preview' | 'history') => void;
  /**
   * Clear all fields from the current form (keeps the same form ID and
   * settings). Pushes to history so the action is undoable.
   */
  resetForm: () => void;
  /**
   * Replace title + description + fields in one shot, preserving settings +
   * cover image. Pushes history so the action is undoable. Used by the AI
   * generate flow.
   */
  replaceSchema: (
    next: { title: string; description: string; fields: FormField[]; tags?: string[] },
    label?: string,
  ) => void;
}

export type FormBuilderStore = FormBuilderState & FormBuilderActions;

export const useFormBuilderStore = create<FormBuilderStore>()((set, get) => ({
  schema: EMPTY_SCHEMA,
  past: [],
  future: [],
  currentLabel: 'Initial state',
  selectedFieldId: null,
  isSubmitSelected: false,
  isCoverSelected: false,
  activeMode: 'edit' as const,
  createdAt: 0,

  loadFromDb: (stored) => {
    cancelDeferred();
    set({
      schema: stored.schema,
      past: stored.past,
      future: stored.future,
      currentLabel: stored.currentLabel,
      createdAt: stored.createdAt,
      selectedFieldId: null,
      isSubmitSelected: false,
      isCoverSelected: false,
      activeMode: 'edit',
    });
  },

  addField: (type) => {
    const newField = buildDefaultField(type);
    set((state) => ({
      schema: {
        ...state.schema,
        fields: [...state.schema.fields, newField],
      },
      past: pushHistory(state.past, state.schema, state.currentLabel),
      future: [],
      currentLabel: `Added ${DEFAULT_LABELS[type]}`,
    }));
  },

  addFieldAt: (type, insertAfterIndex) => {
    const newField = buildDefaultField(type);
    set((state) => {
      const fields = [...state.schema.fields];
      fields.splice(insertAfterIndex, 0, newField);
      return {
        schema: { ...state.schema, fields },
        past: pushHistory(state.past, state.schema, state.currentLabel),
        future: [],
        currentLabel: `Added ${DEFAULT_LABELS[type]}`,
      };
    });
  },

  duplicateField: (id) =>
    set((state) => {
      const index = state.schema.fields.findIndex((f) => f.id === id);
      if (index === -1) return state;
      const original = state.schema.fields[index]!;
      const copy: FormField = {
        ...original,
        id: crypto.randomUUID(),
        label: `${original.label} - Duplicated`,
      };
      const fields = [...state.schema.fields];
      fields.splice(index + 1, 0, copy);
      return {
        schema: { ...state.schema, fields },
        past: pushHistory(state.past, state.schema, state.currentLabel),
        future: [],
        currentLabel: `Duplicated "${original.label}"`,
        selectedFieldId: copy.id,
      };
    }),

  removeField: (id) =>
    set((state) => {
      const field = state.schema.fields.find((f) => f.id === id);
      return {
        schema: {
          ...state.schema,
          fields: state.schema.fields.filter((f) => f.id !== id),
        },
        past: pushHistory(state.past, state.schema, state.currentLabel),
        future: [],
        currentLabel: `Removed "${field?.label ?? 'field'}"`,
        selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId,
      };
    }),

  updateField: (id, updates) =>
    set((state) => {
      const snapshot = deferredSnapshot ?? state.schema;
      cancelDeferred();
      const field = snapshot.fields.find((f) => f.id === id);
      return {
        schema: {
          ...state.schema,
          fields: state.schema.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        },
        past: pushHistory(state.past, snapshot, state.currentLabel),
        future: [],
        currentLabel: `Updated "${field?.label ?? 'field'}"`,
      };
    }),

  updateFieldDeferred: (id, updates) => {
    scheduleDeferredCommit(
      () => get().schema,
      (snapshot) => {
        const current = get();
        if (JSON.stringify(snapshot) === JSON.stringify(current.schema)) return;
        const field = current.schema.fields.find((f) => f.id === id);
        set((s) => ({
          past: pushHistory(s.past, snapshot, s.currentLabel),
          future: [],
          currentLabel: `Updated "${field?.label ?? 'field'}"`,
        }));
      },
    );
    set((state) => ({
      schema: {
        ...state.schema,
        fields: state.schema.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      },
    }));
  },

  updateFieldLabel: (id, label) => {
    scheduleDeferredCommit(
      () => get().schema,
      (snapshot) => {
        const current = get();
        if (JSON.stringify(snapshot) === JSON.stringify(current.schema)) return;
        const field = current.schema.fields.find((f) => f.id === id);
        set((s) => ({
          past: pushHistory(s.past, snapshot, s.currentLabel),
          future: [],
          currentLabel: `Renamed "${field?.label ?? 'field'}"`,
        }));
      },
    );
    set((state) => ({
      schema: {
        ...state.schema,
        fields: state.schema.fields.map((f) => (f.id === id ? { ...f, label } : f)),
      },
    }));
  },

  reorderFields: (fromIndex, toIndex) =>
    set((state) => {
      const fields = [...state.schema.fields];
      const moved = fields[fromIndex];
      if (!moved) return state;
      fields.splice(fromIndex, 1);
      fields.splice(toIndex, 0, moved);
      return {
        schema: { ...state.schema, fields },
        past: pushHistory(state.past, state.schema, state.currentLabel),
        future: [],
        currentLabel: 'Reordered fields',
      };
    }),

  updateTitle: (title) => {
    scheduleDeferredCommit(
      () => get().schema,
      (snapshot) => {
        const current = get();
        if (snapshot.title === current.schema.title) return;
        set((s) => ({
          past: pushHistory(s.past, snapshot, s.currentLabel),
          future: [],
          currentLabel: 'Renamed form',
        }));
      },
    );
    set((state) => ({ schema: { ...state.schema, title } }));
  },

  updateDescription: (description) => {
    scheduleDeferredCommit(
      () => get().schema,
      (snapshot) => {
        const current = get();
        if (snapshot.description === current.schema.description) return;
        set((s) => ({
          past: pushHistory(s.past, snapshot, s.currentLabel),
          future: [],
          currentLabel: 'Updated description',
        }));
      },
    );
    set((state) => ({ schema: { ...state.schema, description } }));
  },

  updateCoverImage: (dataUrl) =>
    set((state) => ({
      schema: { ...state.schema, coverImage: dataUrl ?? undefined },
      past: pushHistory(state.past, state.schema, state.currentLabel),
      future: [],
      currentLabel: dataUrl === null ? 'Removed cover image' : 'Updated cover image',
    })),

  updateSettings: (updates) =>
    set((state) => ({
      schema: {
        ...state.schema,
        settings: { ...state.schema.settings, ...updates },
      },
      past: pushHistory(state.past, state.schema, state.currentLabel),
      future: [],
      currentLabel: 'Updated settings',
    })),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return state;
      cancelDeferred();
      const past = [...state.past];
      const previous = past.pop()!;
      return {
        schema: previous.schema,
        currentLabel: previous.label,
        past,
        future: [
          {
            schema: state.schema,
            label: state.currentLabel,
            timestamp: Date.now(),
          },
          ...state.future,
        ].slice(0, 50),
        selectedFieldId: null,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return state;
      cancelDeferred();
      const future = [...state.future];
      const next = future.shift()!;
      return {
        schema: next.schema,
        currentLabel: next.label,
        past: pushHistory(state.past, state.schema, state.currentLabel),
        future,
        selectedFieldId: null,
      };
    }),

  jumpToHistory: (combinedIndex) =>
    set((state) => {
      const combined = [
        ...state.past,
        {
          schema: state.schema,
          label: state.currentLabel,
          timestamp: Date.now(),
        },
        ...state.future,
      ];
      const target = combined[combinedIndex];
      const currentIdx = state.past.length;
      if (!target || combinedIndex === currentIdx) return state;
      cancelDeferred();
      return {
        schema: target.schema,
        currentLabel: target.label,
        past: combined.slice(0, combinedIndex),
        future: combined.slice(combinedIndex + 1),
        selectedFieldId: null,
      };
    }),

  setSelectedFieldId: (id) =>
    set({ selectedFieldId: id, isSubmitSelected: false, isCoverSelected: false }),
  setIsSubmitSelected: (selected) =>
    set((state) => ({
      isSubmitSelected: selected,
      selectedFieldId: selected ? null : state.selectedFieldId,
      isCoverSelected: selected ? false : state.isCoverSelected,
    })),
  setIsCoverSelected: (selected) =>
    set((state) => ({
      isCoverSelected: selected,
      selectedFieldId: selected ? null : state.selectedFieldId,
      isSubmitSelected: selected ? false : state.isSubmitSelected,
    })),
  clearSelection: () =>
    set({ selectedFieldId: null, isSubmitSelected: false, isCoverSelected: false }),
  setActiveMode: (mode) => set({ activeMode: mode }),

  resetForm: () => {
    cancelDeferred();
    set((state) => ({
      schema: {
        ...state.schema,
        title: 'Untitled Form',
        description: '',
        fields: [],
      },
      past: pushHistory(state.past, state.schema, state.currentLabel),
      future: [],
      currentLabel: 'Cleared form',
      selectedFieldId: null,
      activeMode: 'edit',
    }));
  },

  replaceSchema: (next, label = 'AI generated form') => {
    cancelDeferred();
    set((state) => ({
      schema: {
        ...state.schema,
        title: next.title,
        description: next.description,
        fields: next.fields,
        ...(next.tags !== undefined ? { tags: next.tags } : {}),
      },
      past: pushHistory(state.past, state.schema, state.currentLabel),
      future: [],
      currentLabel: label,
      selectedFieldId: null,
      isSubmitSelected: false,
      isCoverSelected: false,
      activeMode: 'edit',
    }));
  },
}));
