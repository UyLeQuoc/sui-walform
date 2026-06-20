import { expect, test } from 'bun:test';
import * as Y from 'yjs';

import { reconcileSchemaIntoYDoc, seedYDocFromSchema, yDocToSchema } from './collab-schema';
import { SCHEMA_VERSION } from './schema-version';

import type { FormField, FormSchema, FormSettings } from '../../types';

const settings: FormSettings = {
  submitLabel: 'Submit',
  successMessage: 'Thanks',
  submitAlignment: 'center',
  fontFamily: 'inter',
  borderRadius: 4,
  primaryColor: 'default',
  displayMode: 'card',
};

const f1: FormField = { id: 'f1', type: 'short_text', label: 'Name', required: true };
const f2: FormField = {
  id: 'f2',
  type: 'single_choice',
  label: 'Color',
  required: false,
  options: [
    { id: 'o1', label: 'Red', value: 'Red' },
    { id: 'o2', label: 'Blue', value: 'Blue' },
  ],
};
const f3: FormField = { id: 'f3', type: 'number', label: 'Age', required: false };

function baseSchema(): FormSchema {
  return {
    id: 'form1',
    version: SCHEMA_VERSION,
    title: 'My Form',
    description: 'desc',
    fields: [f1, f2, f3],
    settings,
  };
}

function fieldIds(schema: FormSchema): string[] {
  return schema.fields.map((f) => f.id);
}

test('seed → project round-trips a flat schema losslessly', () => {
  const schema = baseSchema();
  const doc = new Y.Doc();
  seedYDocFromSchema(doc, schema);
  expect(yDocToSchema(doc)).toEqual(schema);
});

test('editing a field label projects back', () => {
  const doc = new Y.Doc();
  seedYDocFromSchema(doc, baseSchema());
  reconcileSchemaIntoYDoc(doc, {
    ...baseSchema(),
    fields: [{ ...f1, label: 'Full Name' }, f2, f3],
  });
  const out = yDocToSchema(doc);
  expect(out.fields.find((f) => f.id === 'f1')?.label).toBe('Full Name');
  // unrelated fields untouched
  expect(out.fields.find((f) => f.id === 'f2')?.label).toBe('Color');
});

test('reorder is reflected without duplicating fields', () => {
  const doc = new Y.Doc();
  seedYDocFromSchema(doc, baseSchema());
  reconcileSchemaIntoYDoc(doc, { ...baseSchema(), fields: [f3, f1, f2] });
  expect(fieldIds(yDocToSchema(doc))).toEqual(['f3', 'f1', 'f2']);
});

test('add and remove fields', () => {
  const doc = new Y.Doc();
  seedYDocFromSchema(doc, baseSchema());
  const f4: FormField = { id: 'f4', type: 'email', label: 'Email', required: true };
  reconcileSchemaIntoYDoc(doc, { ...baseSchema(), fields: [f1, f2, f3, f4] });
  expect(fieldIds(yDocToSchema(doc))).toEqual(['f1', 'f2', 'f3', 'f4']);
  reconcileSchemaIntoYDoc(doc, { ...baseSchema(), fields: [f1, f3] });
  expect(fieldIds(yDocToSchema(doc))).toEqual(['f1', 'f3']);
});

test('multi-page partition round-trips and derives fieldIds', () => {
  const schema: FormSchema = {
    ...baseSchema(),
    pages: [
      { id: 'p1', title: 'Page 1', fieldIds: ['f1', 'f2'] },
      { id: 'p2', title: 'Page 2', fieldIds: ['f3'] },
    ],
  };
  const doc = new Y.Doc();
  seedYDocFromSchema(doc, schema);
  const out = yDocToSchema(doc);
  expect(out.pages?.map((p) => p.fieldIds)).toEqual([['f1', 'f2'], ['f3']]);
  expect(fieldIds(out)).toEqual(['f1', 'f2', 'f3']);
});

test('concurrent edits to different fields merge (the CRDT guarantee)', () => {
  const docA = new Y.Doc();
  seedYDocFromSchema(docA, baseSchema());
  const docB = new Y.Doc();
  Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

  reconcileSchemaIntoYDoc(docA, {
    ...baseSchema(),
    fields: [{ ...f1, label: 'A-edit' }, f2, f3],
  });
  reconcileSchemaIntoYDoc(docB, {
    ...baseSchema(),
    fields: [f1, { ...f2, label: 'B-edit' }, f3],
  });

  const updateA = Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB));
  const updateB = Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA));
  Y.applyUpdate(docB, updateA);
  Y.applyUpdate(docA, updateB);

  const outA = yDocToSchema(docA);
  const outB = yDocToSchema(docB);
  expect(outA).toEqual(outB);
  expect(outA.fields.find((f) => f.id === 'f1')?.label).toBe('A-edit');
  expect(outA.fields.find((f) => f.id === 'f2')?.label).toBe('B-edit');
});

test('no-op reconcile keeps positions stable (no churn)', () => {
  const doc = new Y.Doc();
  seedYDocFromSchema(doc, baseSchema());
  const form = doc.getMap('form');
  const fields = form.get('fields') as Y.Map<unknown>;
  const posBefore = ['f1', 'f2', 'f3'].map((id) => (fields.get(id) as Y.Map<unknown>).get('pos'));
  // reconcile the same schema again (e.g. an unrelated render)
  reconcileSchemaIntoYDoc(doc, baseSchema());
  const posAfter = ['f1', 'f2', 'f3'].map((id) => (fields.get(id) as Y.Map<unknown>).get('pos'));
  expect(posAfter).toEqual(posBefore);
});
