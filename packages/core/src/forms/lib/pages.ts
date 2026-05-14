import type {
  FormField,
  FormPage,
  FormSchema,
  NavigationSettings,
} from '../../types';

export const DEFAULT_NAVIGATION: NavigationSettings = {
  mode: 'sequential',
  allowBack: true,
  showProgress: true,
};

export interface NormalizedSchema {
  pages: FormPage[];
  /** Fields grouped by page id, in page order. Guaranteed to cover every input
   * field in `schema.fields` exactly once. */
  fieldsByPage: Map<string, FormField[]>;
  navigation: NavigationSettings;
}

/**
 * Reconcile an authored schema into a stable per-page view.
 *
 * Three cases to handle:
 *  1. No `pages` at all → wrap every field in one implicit page.
 *  2. `pages` present but missing some field ids (e.g. a field was added via a
 *     code path that forgot to update the page) → append those fields to the
 *     last page so they remain visible.
 *  3. `pages` present with stale ids (a field was deleted) → strip them.
 */
export function normalizeSchema(schema: FormSchema): NormalizedSchema {
  const fieldsById = new Map(schema.fields.map((f) => [f.id, f]));
  const seen = new Set<string>();

  let pages: FormPage[] = (schema.pages ?? []).map((page) => ({
    ...page,
    fieldIds: page.fieldIds.filter((id) => {
      if (!fieldsById.has(id)) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  }));

  if (pages.length === 0) {
    pages = [
      {
        id: implicitPageId(schema.id),
        title: undefined,
        description: undefined,
        fieldIds: schema.fields.map((f) => f.id),
      },
    ];
    for (const f of schema.fields) seen.add(f.id);
  } else {
    const orphans = schema.fields.filter((f) => !seen.has(f.id));
    if (orphans.length > 0 && pages.length > 0) {
      const last = pages[pages.length - 1]!;
      pages = pages.map((p, i) =>
        i === pages.length - 1
          ? { ...last, fieldIds: [...last.fieldIds, ...orphans.map((o) => o.id)] }
          : p,
      );
    }
  }

  const fieldsByPage = new Map<string, FormField[]>();
  for (const page of pages) {
    fieldsByPage.set(
      page.id,
      page.fieldIds.map((id) => fieldsById.get(id)!).filter(Boolean),
    );
  }

  return {
    pages,
    fieldsByPage,
    navigation: { ...DEFAULT_NAVIGATION, ...(schema.settings.navigation ?? {}) },
  };
}

const IMPLICIT_PAGE_PREFIX = 'page:implicit:';

/** Stable id for the synthetic single-page wrapper applied to legacy schemas. */
function implicitPageId(schemaId: string): string {
  return `${IMPLICIT_PAGE_PREFIX}${schemaId || 'unknown'}`;
}

export function isImplicitPage(pageId: string): boolean {
  return pageId.startsWith(IMPLICIT_PAGE_PREFIX);
}

/** Locate which page a field id currently belongs to, given a normalized view. */
export function findPageForField(
  fieldId: string,
  pages: FormPage[],
): { page: FormPage; index: number } | null {
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    if (page.fieldIds.includes(fieldId)) return { page, index: i };
  }
  return null;
}
