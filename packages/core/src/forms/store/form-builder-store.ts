import { create } from 'zustand';
import { DEFAULT_CODE_LANGUAGE } from '../lib/code-languages';
import { isInputField } from '../lib/field-types';
import { DEFAULT_BORDER_RADIUS, DEFAULT_FORM_COLOR_KEY } from '../lib/form-appearance';
import { DEFAULT_FORM_FONT_KEY } from '../lib/form-fonts';
import { SCHEMA_VERSION } from '../lib/schema-version';
import type {
  FieldType,
  FormField,
  FormPage,
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
    required: isInputField({ type }),
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

/**
 * Ensure `schema.pages` exists. Materializes a single default page containing
 * every existing field if pages are absent. Safe to call any number of times.
 */
function ensurePages(schema: FormSchema): FormSchema {
  if (schema.pages && schema.pages.length > 0) return schema;
  const page: FormPage = {
    id: crypto.randomUUID(),
    fieldIds: schema.fields.map((f) => f.id),
  };
  return { ...schema, pages: [page] };
}

function appendFieldIdToActivePage(
  schema: FormSchema,
  fieldId: string,
  activePageId: string | null,
): FormSchema {
  if (!schema.pages || schema.pages.length === 0) return schema;
  const targetIdx =
    activePageId !== null
      ? Math.max(
          0,
          schema.pages.findIndex((p) => p.id === activePageId),
        )
      : schema.pages.length - 1;
  const pages = schema.pages.map((p, i) =>
    i === targetIdx ? { ...p, fieldIds: [...p.fieldIds, fieldId] } : p,
  );
  return { ...schema, pages };
}

function insertFieldIdNearAnchor(
  schema: FormSchema,
  fieldId: string,
  anchorFieldId: string | null,
  offset: 0 | 1,
): FormSchema {
  if (!schema.pages || schema.pages.length === 0) return schema;
  if (!anchorFieldId) return appendFieldIdToActivePage(schema, fieldId, null);
  const pages = schema.pages.map((p) => {
    const idx = p.fieldIds.indexOf(anchorFieldId);
    if (idx === -1) return p;
    const next = [...p.fieldIds];
    next.splice(idx + offset, 0, fieldId);
    return { ...p, fieldIds: next };
  });
  return { ...schema, pages };
}

function dropFieldIdFromPages(schema: FormSchema, fieldId: string): FormSchema {
  if (!schema.pages || schema.pages.length === 0) return schema;
  const pages = schema.pages.map((p) =>
    p.fieldIds.includes(fieldId)
      ? { ...p, fieldIds: p.fieldIds.filter((id) => id !== fieldId) }
      : p,
  );
  return { ...schema, pages };
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
  /**
   * The page currently focused in the canvas — new fields added via the
   * palette land here, and the page header inspector keys off it. `null`
   * when no pages exist (single implicit-page mode) or before the first
   * page is materialized.
   */
  activePageId: string | null;
}

interface FormBuilderActions {
  /** Populate the store from a stored form (called by FormEditorClient on mount). */
  loadFromDb: (stored: StoredForm) => void;
  addField: (type: FieldType) => void;
  /**
   * Insert a new field at the given flat index. When `targetPageId` is
   * provided, the field is also placed inside that page (at the position
   * implied by the flat index); otherwise it lands on the active page.
   */
  addFieldAt: (type: FieldType, insertAfterIndex: number, targetPageId?: string) => void;
  removeField: (id: string) => void;
  duplicateField: (id: string) => void;
  /** Add a new page after the given page (or at the end if `null`). Materializes
   * `schema.pages` if it wasn't already. */
  addPage: (afterPageId?: string | null) => void;
  removePage: (id: string) => void;
  renamePage: (id: string, title: string) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  /** Move a field from its current page to another. `toIndex` is the position
   * inside the destination page's `fieldIds`; pass `-1` to append. */
  moveFieldToPage: (fieldId: string, toPageId: string, toIndex: number) => void;
  setActivePageId: (id: string | null) => void;
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
  activePageId: null,

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
      activePageId: stored.schema.pages?.[0]?.id ?? null,
    });
  },

  addField: (type) => {
    const newField = buildDefaultField(type);
    set((state) => {
      let next: FormSchema = {
        ...state.schema,
        fields: [...state.schema.fields, newField],
      };
      if (next.pages && next.pages.length > 0) {
        next = appendFieldIdToActivePage(next, newField.id, state.activePageId);
        const pages = next.pages ?? [];
        const fieldsById = new Map(next.fields.map((f) => [f.id, f]));
        next = {
          ...next,
          fields: pages.flatMap((p) =>
            p.fieldIds.map((id) => fieldsById.get(id)!).filter(Boolean),
          ),
        };
      }
      return {
        schema: next,
        past: pushHistory(state.past, state.schema, state.currentLabel),
        future: [],
        currentLabel: `Added ${DEFAULT_LABELS[type]}`,
      };
    });
  },

  addFieldAt: (type, insertAfterIndex, targetPageId) => {
    const newField = buildDefaultField(type);
    set((state) => {
      const fields = [...state.schema.fields];
      fields.splice(insertAfterIndex, 0, newField);
      let next: FormSchema = { ...state.schema, fields };
      // Page placement priority:
      //   1. Anchor in target/active page → insert next to the anchor.
      //   2. No anchor on target/active page → append to that page.
      if (next.pages && next.pages.length > 0) {
        const pageId = targetPageId ?? state.activePageId ?? null;
        const targetPage = pageId ? next.pages.find((p) => p.id === pageId) : null;
        const anchorBefore = state.schema.fields[insertAfterIndex - 1]?.id ?? null;
        const anchorAfter = state.schema.fields[insertAfterIndex]?.id ?? null;
        const anchorInPage =
          targetPage &&
          ((anchorBefore && targetPage.fieldIds.includes(anchorBefore)) ||
            (anchorAfter && targetPage.fieldIds.includes(anchorAfter)))
            ? anchorBefore && targetPage.fieldIds.includes(anchorBefore)
              ? anchorBefore
              : anchorAfter
            : null;
        if (anchorInPage) {
          next = insertFieldIdNearAnchor(
            next,
            newField.id,
            anchorInPage,
            anchorInPage === anchorBefore ? 1 : 0,
          );
        } else {
          next = appendFieldIdToActivePage(next, newField.id, pageId);
        }
        // Re-sync flat order with page partition so subsequent indexing stays
        // consistent (page strip + canvas reads pages directly).
        const pages = next.pages ?? [];
        const fieldsById = new Map(next.fields.map((f) => [f.id, f]));
        next = {
          ...next,
          fields: pages.flatMap((p) =>
            p.fieldIds.map((id) => fieldsById.get(id)!).filter(Boolean),
          ),
        };
      }
      return {
        schema: next,
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
      let next: FormSchema = { ...state.schema, fields };
      next = insertFieldIdNearAnchor(next, copy.id, original.id, 1);
      return {
        schema: next,
        past: pushHistory(state.past, state.schema, state.currentLabel),
        future: [],
        currentLabel: `Duplicated "${original.label}"`,
        selectedFieldId: copy.id,
      };
    }),

  removeField: (id) =>
    set((state) => {
      const field = state.schema.fields.find((f) => f.id === id);
      let next: FormSchema = {
        ...state.schema,
        fields: state.schema.fields.filter((f) => f.id !== id),
      };
      next = dropFieldIdFromPages(next, id);
      return {
        schema: next,
        past: pushHistory(state.past, state.schema, state.currentLabel),
        future: [],
        currentLabel: `Removed "${field?.label ?? 'field'}"`,
        selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId,
      };
    }),

  addPage: (afterPageId) =>
    set((state) => {
      const seeded = ensurePages(state.schema);
      const pages = seeded.pages!;
      const insertIdx =
        afterPageId === undefined || afterPageId === null
          ? pages.length
          : Math.max(0, pages.findIndex((p) => p.id === afterPageId) + 1);
      const newPage: FormPage = {
        id: crypto.randomUUID(),
        title: `Page ${pages.length + 1}`,
        fieldIds: [],
      };
      const nextPages = [...pages];
      nextPages.splice(insertIdx, 0, newPage);
      return {
        schema: { ...seeded, pages: nextPages },
        past: pushHistory(state.past, state.schema, state.currentLabel),
        future: [],
        currentLabel: `Added ${newPage.title}`,
        activePageId: newPage.id,
      };
    }),

  removePage: (id) =>
    set((state) => {
      if (!state.schema.pages || state.schema.pages.length <= 1) return state;
      const target = state.schema.pages.find((p) => p.id === id);
      if (!target) return state;
      const remaining = state.schema.pages.filter((p) => p.id !== id);
      // Re-home displaced fields onto the previous page (or first remaining).
      const idx = state.schema.pages.findIndex((p) => p.id === id);
      const homeIdx = Math.max(0, Math.min(remaining.length - 1, idx - 1));
      const home = remaining[homeIdx]!;
      const merged = remaining.map((p, i) =>
        i === homeIdx ? { ...p, fieldIds: [...home.fieldIds, ...target.fieldIds] } : p,
      );
      return {
        schema: {
          ...state.schema,
          pages: merged,
        },
        past: pushHistory(state.past, state.schema, state.currentLabel),
        future: [],
        currentLabel: `Removed "${target.title ?? 'page'}"`,
        activePageId: state.activePageId === id ? merged[homeIdx]!.id : state.activePageId,
      };
    }),

  renamePage: (id, title) => {
    scheduleDeferredCommit(
      () => get().schema,
      (snapshot) => {
        const current = get();
        if (JSON.stringify(snapshot.pages) === JSON.stringify(current.schema.pages)) return;
        set((s) => ({
          past: pushHistory(s.past, snapshot, s.currentLabel),
          future: [],
          currentLabel: 'Renamed page',
        }));
      },
    );
    set((state) => ({
      schema: {
        ...state.schema,
        pages: state.schema.pages?.map((p) => (p.id === id ? { ...p, title } : p)),
      },
    }));
  },

  reorderPages: (fromIndex, toIndex) =>
    set((state) => {
      if (!state.schema.pages) return state;
      const pages = [...state.schema.pages];
      const moved = pages[fromIndex];
      if (!moved) return state;
      pages.splice(fromIndex, 1);
      pages.splice(toIndex, 0, moved);
      // Mirror the new page order into the flat fields array so downstream
      // consumers that still iterate `schema.fields` see the same sequence.
      const fieldsById = new Map(state.schema.fields.map((f) => [f.id, f]));
      const fields = pages.flatMap((p) =>
        p.fieldIds.map((id) => fieldsById.get(id)!).filter(Boolean),
      );
      return {
        schema: { ...state.schema, pages, fields },
        past: pushHistory(state.past, state.schema, state.currentLabel),
        future: [],
        currentLabel: 'Reordered pages',
      };
    }),

  moveFieldToPage: (fieldId, toPageId, toIndex) =>
    set((state) => {
      if (!state.schema.pages) return state;
      const fromPage = state.schema.pages.find((p) => p.fieldIds.includes(fieldId));
      if (!fromPage) return state;
      const pages = state.schema.pages.map((p) => {
        if (p.id === fromPage.id && p.id === toPageId) {
          // Reorder within same page.
          const ids = p.fieldIds.filter((id) => id !== fieldId);
          const i = toIndex < 0 || toIndex > ids.length ? ids.length : toIndex;
          ids.splice(i, 0, fieldId);
          return { ...p, fieldIds: ids };
        }
        if (p.id === fromPage.id) {
          return { ...p, fieldIds: p.fieldIds.filter((id) => id !== fieldId) };
        }
        if (p.id === toPageId) {
          const ids = [...p.fieldIds];
          const i = toIndex < 0 || toIndex > ids.length ? ids.length : toIndex;
          ids.splice(i, 0, fieldId);
          return { ...p, fieldIds: ids };
        }
        return p;
      });
      // Re-sync flat field order to match the new page partition.
      const fieldsById = new Map(state.schema.fields.map((f) => [f.id, f]));
      const fields = pages.flatMap((p) =>
        p.fieldIds.map((id) => fieldsById.get(id)!).filter(Boolean),
      );
      return {
        schema: { ...state.schema, pages, fields },
        past: pushHistory(state.past, state.schema, state.currentLabel),
        future: [],
        currentLabel: 'Moved field',
      };
    }),

  setActivePageId: (id) => set({ activePageId: id }),

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
      let nextSchema: FormSchema = { ...state.schema, fields };
      // Keep page partitions consistent with the new flat order. We rebuild
      // each page's `fieldIds` by intersecting the flat order with the
      // existing per-page membership. A field that moved across pages keeps
      // its old page assignment unless it crossed a page boundary in the
      // flat order; in that case we infer the new page from its neighbors.
      if (nextSchema.pages && nextSchema.pages.length > 0) {
        const fromPage = state.schema.pages?.find((p) => p.fieldIds.includes(moved.id));
        // Determine target page by looking at the neighbor at the destination.
        const after = fields[toIndex + 1];
        const before = fields[toIndex - 1];
        const targetPage =
          (after && state.schema.pages?.find((p) => p.fieldIds.includes(after.id))) ||
          (before && state.schema.pages?.find((p) => p.fieldIds.includes(before.id))) ||
          fromPage ||
          nextSchema.pages[0]!;
        const pages = nextSchema.pages.map((p) => {
          if (p.id === fromPage?.id && p.id === targetPage.id) {
            const ids = p.fieldIds.filter((id) => id !== moved.id);
            // Insert at position of the destination neighbor inside the page.
            let pos = ids.length;
            if (after) {
              const i = ids.indexOf(after.id);
              if (i !== -1) pos = i;
            } else if (before) {
              const i = ids.indexOf(before.id);
              if (i !== -1) pos = i + 1;
            }
            const nextIds = [...ids];
            nextIds.splice(pos, 0, moved.id);
            return { ...p, fieldIds: nextIds };
          }
          if (p.id === fromPage?.id) {
            return { ...p, fieldIds: p.fieldIds.filter((id) => id !== moved.id) };
          }
          if (p.id === targetPage.id) {
            const ids = [...p.fieldIds];
            let pos = ids.length;
            if (after) {
              const i = ids.indexOf(after.id);
              if (i !== -1) pos = i;
            } else if (before) {
              const i = ids.indexOf(before.id);
              if (i !== -1) pos = i + 1;
            }
            ids.splice(pos, 0, moved.id);
            return { ...p, fieldIds: ids };
          }
          return p;
        });
        nextSchema = { ...nextSchema, pages };
      }
      return {
        schema: nextSchema,
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
        activePageId:
          previous.schema.pages?.find((p) => p.id === state.activePageId)?.id ??
          previous.schema.pages?.[0]?.id ??
          null,
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
        activePageId:
          next.schema.pages?.find((p) => p.id === state.activePageId)?.id ??
          next.schema.pages?.[0]?.id ??
          null,
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
        activePageId: target.schema.pages?.[0]?.id ?? null,
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
        pages: undefined,
      },
      past: pushHistory(state.past, state.schema, state.currentLabel),
      future: [],
      currentLabel: 'Cleared form',
      selectedFieldId: null,
      activeMode: 'edit',
      activePageId: null,
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
        // AI returns a flat field list — drop any prior page state so we
        // don't carry references to deleted field ids.
        pages: undefined,
        ...(next.tags !== undefined ? { tags: next.tags } : {}),
      },
      past: pushHistory(state.past, state.schema, state.currentLabel),
      future: [],
      currentLabel: label,
      selectedFieldId: null,
      isSubmitSelected: false,
      isCoverSelected: false,
      activeMode: 'edit',
      activePageId: null,
    }));
  },
}));
