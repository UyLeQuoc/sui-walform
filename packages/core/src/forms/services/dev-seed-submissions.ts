import { faker } from '@faker-js/faker';
import type { FormField } from '../../types';
import type { SubmissionRow } from '../hooks/use-form-submissions';

/**
 * Dev-only in-memory seeder for the Results page. Fakes both the chain-side
 * `SubmissionRow` and a pre-"decrypted" payload so the analytics dashboard
 * has data to render without any wallet, gas, or Seal session.
 *
 * Data lives in module memory keyed by `formId` and is lost on full page
 * reload — exactly what we want for a transient demo state. A custom
 * `EventTarget` lets components subscribe and rerender on mutations.
 */

export interface SeededSubmission {
  row: SubmissionRow;
  decrypted: Record<string, unknown>;
}

const store = new Map<string, SeededSubmission[]>();
const bus = typeof window !== 'undefined' ? new EventTarget() : null;
const CHANGE_EVENT = 'walform:seeded-submissions-changed';

// Shared empty sentinel so getSnapshot returns the same reference for any
// formId that has never been seeded. Without this, useSyncExternalStore sees
// a fresh `[]` on every read and infinite-loops.
const EMPTY: readonly SeededSubmission[] = Object.freeze([]);

function notify(formId: string): void {
  bus?.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { formId } }));
}

export function subscribeSeededSubmissions(
  formId: string,
  listener: () => void,
): () => void {
  if (!bus) return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ formId: string }>).detail;
    if (detail.formId === formId) listener();
  };
  bus.addEventListener(CHANGE_EVENT, handler);
  return () => bus.removeEventListener(CHANGE_EVENT, handler);
}

export function getSeededSubmissions(formId: string): SeededSubmission[] {
  // Returning the same `EMPTY` reference for never-seeded forms keeps
  // useSyncExternalStore's snapshot equality check happy.
  return store.get(formId) ?? (EMPTY as SeededSubmission[]);
}

export function clearSeededSubmissions(formId: string): number {
  const n = store.get(formId)?.length ?? 0;
  store.delete(formId);
  notify(formId);
  return n;
}

export function seedSubmissions(
  formId: string,
  fields: FormField[],
  count: number,
): SeededSubmission[] {
  const additions: SeededSubmission[] = Array.from({ length: count }, () =>
    buildFakeSubmission(formId, fields),
  );
  const current = store.get(formId) ?? [];
  store.set(formId, [...current, ...additions]);
  notify(formId);
  return additions;
}

function buildFakeSubmission(formId: string, fields: FormField[]): SeededSubmission {
  const decrypted: Record<string, unknown> = {};
  for (const field of fields) {
    const value = randomValueForField(field);
    if (value !== undefined) decrypted[field.id] = value;
  }

  // Submitter timestamps spread over the last 30 days so the timeline shows
  // actual distribution rather than every row stacking on "today".
  const submittedAtMs = faker.date.recent({ days: 30 }).getTime();

  const row: SubmissionRow = {
    submissionId: `0x${faker.string.hexadecimal({
      length: 64,
      casing: 'lower',
      prefix: '',
    })}`,
    formId,
    submitter: `0x${faker.string.hexadecimal({
      length: 64,
      casing: 'lower',
      prefix: '',
    })}`,
    ciphertext: new Uint8Array(),
    nonce: new Uint8Array(),
    fileBlobIds: [],
    submittedAtMs,
  };

  return { row, decrypted };
}

function randomValueForField(field: FormField): unknown {
  // ~12% of inputs get left blank so skip-rate stats aren't always zero.
  if (
    !field.required &&
    field.type !== 'heading' &&
    field.type !== 'description' &&
    field.type !== 'divider' &&
    field.type !== 'space' &&
    faker.datatype.boolean({ probability: 0.12 })
  ) {
    return undefined;
  }

  switch (field.type) {
    case 'short_text':
      return faker.lorem.words({ min: 1, max: 4 });
    case 'long_text':
      return faker.lorem.sentences({ min: 1, max: 3 });
    case 'email':
      return faker.internet.email().toLowerCase();
    case 'phone':
      return faker.phone.number();
    case 'url':
      return faker.internet.url();
    case 'number': {
      const min = field.validation?.min ?? 0;
      const max = field.validation?.max ?? Math.max(min + 100, 100);
      return faker.number.int({ min, max });
    }
    case 'date':
      return faker.date
        .between({
          from: faker.date.past({ years: 1 }),
          to: faker.date.future({ years: 1 }),
        })
        .toISOString()
        .slice(0, 10);
    case 'time': {
      const h = faker.number.int({ min: 0, max: 23 }).toString().padStart(2, '0');
      const m = faker.number.int({ min: 0, max: 59 }).toString().padStart(2, '0');
      return `${h}:${m}`;
    }
    case 'single_choice':
    case 'select': {
      const opts = field.options ?? [];
      if (opts.length === 0) return undefined;
      return faker.helpers.arrayElement(opts).value;
    }
    case 'multiple_choice': {
      const opts = field.options ?? [];
      if (opts.length === 0) return [];
      const pickCount = faker.number.int({ min: 1, max: opts.length });
      return faker.helpers.arrayElements(opts, pickCount).map((o) => o.value);
    }
    case 'rating': {
      const max = field.validation?.max ?? 5;
      return faker.number.int({ min: 1, max });
    }
    case 'linear_scale': {
      const from = field.validation?.scaleFrom ?? 1;
      const to = field.validation?.scaleTo ?? 5;
      const jump = field.validation?.scaleJump ?? 1;
      const steps = Math.floor((to - from) / jump);
      return from + faker.number.int({ min: 0, max: steps }) * jump;
    }
    case 'yes_no':
      return faker.datatype.boolean({ probability: 0.6 }) ? 'yes' : 'no';
    case 'file':
      // Fake aggregator URL — clicking won't resolve, but the cell renders.
      return `https://aggregator.walrus-testnet.walrus.space/v1/blobs/seeded-${faker.string.alphanumeric(12)}`;
    // Layout-only fields have no answer.
    case 'heading':
    case 'description':
    case 'markdown':
    case 'code':
    case 'divider':
    case 'space':
      return undefined;
    default:
      return undefined;
  }
}
