/**
 * IDB-backed creator-local notes on each Submission: status (workflow) +
 * priority (triage). Scoped to the form's id so creators can return to a
 * form's results and pick up where they left off — without polluting the
 * Sui Submission object with creator-side workflow noise.
 *
 * Records use `${formId}:${submissionId}` as the IDB key. Missing record =
 * defaults ('new' + 'none'). Mutations dispatch `walform:submission-tags-changed`
 * so the hook can re-read after any update.
 */

const DB_NAME = 'walform-submission-tags';
const DB_VERSION = 1;
const STORE = 'tags';
const CHANGE_EVENT = 'walform:submission-tags-changed';

export type SubmissionStatus = 'new' | 'acked' | 'in_progress' | 'resolved' | 'closed' | 'spam';
export type SubmissionPriority = 'none' | 'low' | 'med' | 'high' | 'urgent';

export interface SubmissionTag {
  key: string;
  formId: string;
  submissionId: string;
  status: SubmissionStatus;
  priority: SubmissionPriority;
  updatedAt: number;
}

export const DEFAULT_STATUS: SubmissionStatus = 'new';
export const DEFAULT_PRIORITY: SubmissionPriority = 'none';

export const STATUS_OPTIONS: ReadonlyArray<{ value: SubmissionStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'acked', label: 'Acknowledged' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'spam', label: 'Spam' },
];

export const PRIORITY_OPTIONS: ReadonlyArray<{ value: SubmissionPriority; label: string }> = [
  { value: 'none', label: 'No priority' },
  { value: 'low', label: 'Low' },
  { value: 'med', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('by-form', 'formId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(new Error(`Failed to open IDB: ${req.error?.message ?? 'unknown'}`));
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error('IDB open blocked by another tab'));
    };
  });
  return dbPromise;
}

function key(formId: string, submissionId: string): string {
  return `${formId}:${submissionId}`;
}

function dispatchChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

export const submissionTagsDb = {
  changeEvent: CHANGE_EVENT,

  async listByForm(formId: string): Promise<SubmissionTag[]> {
    const db = await getDb();
    return new Promise<SubmissionTag[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const idx = tx.objectStore(STORE).index('by-form');
      const out: SubmissionTag[] = [];
      const cursorReq = idx.openCursor(IDBKeyRange.only(formId));
      cursorReq.onsuccess = () => {
        const c = cursorReq.result;
        if (!c) return resolve(out);
        out.push(c.value as SubmissionTag);
        c.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error ?? new Error('cursor failed'));
    });
  },

  async upsert(input: {
    formId: string;
    submissionId: string;
    status?: SubmissionStatus;
    priority?: SubmissionPriority;
  }): Promise<void> {
    const db = await getDb();
    const k = key(input.formId, input.submissionId);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const getReq = store.get(k);
      getReq.onsuccess = () => {
        const existing = (getReq.result as SubmissionTag | undefined) ?? {
          key: k,
          formId: input.formId,
          submissionId: input.submissionId,
          status: DEFAULT_STATUS,
          priority: DEFAULT_PRIORITY,
          updatedAt: 0,
        };
        const next: SubmissionTag = {
          ...existing,
          status: input.status ?? existing.status,
          priority: input.priority ?? existing.priority,
          updatedAt: Date.now(),
        };
        const putReq = store.put(next);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error ?? new Error('put failed'));
      };
      getReq.onerror = () => reject(getReq.error ?? new Error('get failed'));
    });
    dispatchChange();
  },
};
