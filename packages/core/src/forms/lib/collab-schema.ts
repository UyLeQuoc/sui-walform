import { generateNKeysBetween } from 'fractional-indexing';
import * as Y from 'yjs';

import { SCHEMA_VERSION } from './schema-version';

import type { FormField, FormPage, FormSchema, FormSettings } from '../../types';

// Maps a flat `FormSchema` onto a Yjs document and back. The Y doc is the
// authoritative live state during a collab session; this module is the only
// place that knows the doc's internal shape. Order + page membership live ON
// each field (`pageId` + fractional `pos`), so the flat `fields[]` and per-page
// `fieldIds[]` the rest of the app expects are derived projections — never two
// ordered structures the CRDT must keep in lockstep.
//
// Doc shape:
//   Y.Map "form"
//     id, title, description, coverImage, version : scalar (LWW)
//     tags     : plain string[] value (LWW)
//     settings : Y.Map (per-key LWW)
//     fields   : Y.Map keyed by field id -> Y.Map { ...FormField, pageId, pos }
//     pages    : Y.Map keyed by page id  -> Y.Map { id, title, description, pos }

const FORM_KEY = 'form';

type YMap = Y.Map<unknown>;

export function createFormYDoc(): Y.Doc {
  return new Y.Doc();
}

function getFormMap(doc: Y.Doc): YMap {
  return doc.getMap(FORM_KEY) as YMap;
}

function getOrCreateMap(parent: YMap, key: string): YMap {
  const existing = parent.get(key);
  if (existing instanceof Y.Map) return existing as YMap;
  const created = new Y.Map() as YMap;
  parent.set(key, created);
  return created;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function setIfChanged(map: YMap, key: string, value: unknown): void {
  if (valuesEqual(map.get(key), value)) return;
  map.set(key, value);
}

// Target order of fields as { id, pageId } pairs. When pages exist, page order
// + each page's fieldIds drive it; otherwise the flat field order does.
function canonicalOrder(schema: FormSchema): { id: string; pageId: string }[] {
  const pages = schema.pages ?? [];
  if (pages.length === 0) {
    return schema.fields.map((f) => ({ id: f.id, pageId: '' }));
  }
  const fieldIds = new Set(schema.fields.map((f) => f.id));
  const firstPageId = pages[0]?.id ?? '';
  const seen = new Set<string>();
  const out: { id: string; pageId: string }[] = [];
  for (const page of pages) {
    for (const fid of page.fieldIds) {
      if (fieldIds.has(fid) && !seen.has(fid)) {
        out.push({ id: fid, pageId: page.id });
        seen.add(fid);
      }
    }
  }
  for (const f of schema.fields) {
    if (!seen.has(f.id)) out.push({ id: f.id, pageId: firstPageId });
  }
  return out;
}

// Regenerate `pos` for an ordered id group only when the existing positions no
// longer form a strictly increasing sequence (i.e. the order changed or a new
// member lacks a key). A pure edit with unchanged order writes nothing.
function reassignPositions(container: YMap, orderedIds: string[]): void {
  const positions = orderedIds.map((id) => {
    const m = container.get(id);
    return m instanceof Y.Map ? m.get('pos') : undefined;
  });
  let ordered = true;
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (typeof pos !== 'string') {
      ordered = false;
      break;
    }
    if (i > 0) {
      const prev = positions[i - 1];
      if (typeof prev !== 'string' || !(prev < pos)) {
        ordered = false;
        break;
      }
    }
  }
  if (ordered) return;
  const keys = generateNKeysBetween(null, null, orderedIds.length);
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    const key = keys[i];
    if (id === undefined || key === undefined) continue;
    const m = container.get(id);
    if (m instanceof Y.Map) setIfChanged(m as YMap, 'pos', key);
  }
}

function setFieldProps(fieldMap: YMap, field: FormField): void {
  const obj = field as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    setIfChanged(fieldMap, key, value);
  }
  for (const key of [...fieldMap.keys()]) {
    if (key === 'pageId' || key === 'pos') continue;
    if (obj[key] === undefined) fieldMap.delete(key);
  }
}

function reconcilePages(pagesMap: YMap, schema: FormSchema): void {
  const pages = schema.pages ?? [];
  const present = new Set<string>();
  for (const page of pages) {
    const pm = getOrCreateMap(pagesMap, page.id);
    setIfChanged(pm, 'id', page.id);
    setIfChanged(pm, 'title', page.title ?? '');
    setIfChanged(pm, 'description', page.description ?? '');
    present.add(page.id);
  }
  for (const key of [...pagesMap.keys()]) {
    if (!present.has(key)) pagesMap.delete(key);
  }
  reassignPositions(
    pagesMap,
    pages.map((p) => p.id),
  );
}

/**
 * Apply a plain `FormSchema` onto the Y doc, mutating only what changed. The
 * caller wraps this in `doc.transact(fn, origin)` so undo/echo guards work.
 */
export function reconcileSchemaIntoYDoc(doc: Y.Doc, schema: FormSchema): void {
  const form = getFormMap(doc);

  setIfChanged(form, 'id', schema.id);
  setIfChanged(form, 'title', schema.title);
  setIfChanged(form, 'description', schema.description ?? '');
  setIfChanged(form, 'coverImage', schema.coverImage ?? '');
  setIfChanged(form, 'version', schema.version ?? SCHEMA_VERSION);
  setIfChanged(form, 'tags', schema.tags ?? []);

  const settings = getOrCreateMap(form, 'settings');
  const settingsObj = schema.settings as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(settingsObj)) {
    if (value === undefined) continue;
    setIfChanged(settings, key, value);
  }
  for (const key of [...settings.keys()]) {
    if (settingsObj[key] === undefined) settings.delete(key);
  }

  reconcilePages(getOrCreateMap(form, 'pages'), schema);

  const fieldsMap = getOrCreateMap(form, 'fields');
  const order = canonicalOrder(schema);
  const present = new Set<string>();
  for (const { id, pageId } of order) {
    const field = schema.fields.find((f) => f.id === id);
    if (!field) continue;
    const fm = getOrCreateMap(fieldsMap, id);
    setFieldProps(fm, field);
    setIfChanged(fm, 'pageId', pageId);
    present.add(id);
  }
  for (const key of [...fieldsMap.keys()]) {
    if (!present.has(key)) fieldsMap.delete(key);
  }

  const groups = new Map<string, string[]>();
  for (const { id, pageId } of order) {
    const list = groups.get(pageId) ?? [];
    list.push(id);
    groups.set(pageId, list);
  }
  for (const ids of groups.values()) {
    reassignPositions(fieldsMap, ids);
  }
}

/** Seed an empty (or fresh) Y doc from a schema. Equivalent to a reconcile. */
export function seedYDocFromSchema(doc: Y.Doc, schema: FormSchema): void {
  reconcileSchemaIntoYDoc(doc, schema);
}

function readField(fieldMap: YMap): FormField {
  const obj = fieldMap.toJSON() as Record<string, unknown>;
  delete obj.pageId;
  delete obj.pos;
  return obj as unknown as FormField;
}

type FieldRecord = { id: string; pageId: string; pos: string; field: FormField };

function readFieldRecords(fieldsMap: YMap): FieldRecord[] {
  const records: FieldRecord[] = [];
  for (const [id, value] of fieldsMap.entries()) {
    if (!(value instanceof Y.Map)) continue;
    const fm = value as YMap;
    records.push({
      id,
      pageId: asString(fm.get('pageId')),
      pos: asString(fm.get('pos')),
      field: readField(fm),
    });
  }
  return records;
}

type PageRecord = { id: string; title: string; description: string; pos: string };

function readPageRecords(pagesMap: YMap): PageRecord[] {
  const records: PageRecord[] = [];
  for (const [id, value] of pagesMap.entries()) {
    if (!(value instanceof Y.Map)) continue;
    const pm = value as YMap;
    records.push({
      id,
      title: asString(pm.get('title')),
      description: asString(pm.get('description')),
      pos: asString(pm.get('pos')),
    });
  }
  records.sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0));
  return records;
}

/** Rebuild the flat `FormSchema` the editor binds to from the Y doc. */
export function yDocToSchema(doc: Y.Doc): FormSchema {
  const form = getFormMap(doc);
  const settingsValue = form.get('settings');
  const settings =
    settingsValue instanceof Y.Map
      ? (settingsValue.toJSON() as unknown as FormSettings)
      : ({} as FormSettings);
  const tagsValue = form.get('tags');
  const tags = Array.isArray(tagsValue) ? (tagsValue as string[]) : [];
  const coverImage = asString(form.get('coverImage'));
  const versionValue = form.get('version');

  const fieldsValue = form.get('fields');
  const fieldRecords = fieldsValue instanceof Y.Map ? readFieldRecords(fieldsValue as YMap) : [];
  const byPos = (a: FieldRecord, b: FieldRecord) =>
    a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0;

  const pagesValue = form.get('pages');
  const pageRecords = pagesValue instanceof Y.Map ? readPageRecords(pagesValue as YMap) : [];

  const base = {
    id: asString(form.get('id')),
    version: typeof versionValue === 'number' ? versionValue : SCHEMA_VERSION,
    title: asString(form.get('title')),
    description: asString(form.get('description')),
    settings,
    ...(coverImage ? { coverImage } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };

  if (pageRecords.length === 0) {
    const fields = [...fieldRecords].sort(byPos).map((r) => r.field);
    return { ...base, fields };
  }

  const recordById = new Map(fieldRecords.map((r) => [r.id, r]));
  const knownPageIds = new Set(pageRecords.map((p) => p.id));
  const pages: FormPage[] = pageRecords.map((p) => ({
    id: p.id,
    ...(p.title ? { title: p.title } : {}),
    ...(p.description ? { description: p.description } : {}),
    fieldIds: fieldRecords
      .filter((r) => r.pageId === p.id)
      .sort(byPos)
      .map((r) => r.id),
  }));
  const leftovers = fieldRecords
    .filter((r) => !knownPageIds.has(r.pageId))
    .sort(byPos)
    .map((r) => r.id);
  const firstPage = pages[0];
  if (leftovers.length > 0 && firstPage) {
    firstPage.fieldIds.push(...leftovers);
  }
  const fields = pages
    .flatMap((p) => p.fieldIds)
    .map((id) => recordById.get(id)?.field)
    .filter((f): f is FormField => f !== undefined);

  return { ...base, fields, pages };
}
