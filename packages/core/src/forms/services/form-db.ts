import type { StoredForm } from '../../types';

const DB_NAME = 'form-builder';
const DB_VERSION = 1;
const FORMS_STORE = 'forms';
const CHANGE_EVENT = 'walform:forms-changed';

const RETRY_BACKOFFS_MS = [100, 300, 700];

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FORMS_STORE)) {
        db.createObjectStore(FORMS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);

    request.onerror = () => {
      dbPromise = null;
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message ?? 'unknown error'}`));
    };

    request.onblocked = () => {
      dbPromise = null;
      reject(new Error('IndexedDB open was blocked by another tab'));
    };
  });

  return dbPromise;
}

function read<T>(db: IDBDatabase, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FORMS_STORE, 'readonly');
    const request = fn(tx.objectStore(FORMS_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Run a readwrite transaction. The callback is handed the live store and
 * a `done(value)` setter; whatever it passes to `done` becomes the
 * resolved value once `tx.oncomplete` fires. If the callback throws or
 * calls `fail(err)`, the tx aborts and the promise rejects.
 */
function writeTx<T>(
  db: IDBDatabase,
  fn: (store: IDBObjectStore, done: (value: T) => void, fail: (err: Error) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let result: T | undefined;
    let resolved = false;
    let abortError: Error | null = null;

    let tx: IDBTransaction;
    try {
      tx = db.transaction(FORMS_STORE, 'readwrite');
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }

    const fail = (err: Error) => {
      abortError = err;
      try {
        tx.abort();
      } catch {
        // Already aborted/finished; the abort handler still fires.
      }
    };

    tx.oncomplete = () => {
      notifyChange();
      if (resolved) resolve(result as T);
      else reject(new Error('IDB transaction completed without a result'));
    };
    tx.onerror = () => reject(abortError ?? tx.error ?? new Error('IDB transaction failed'));
    tx.onabort = () => reject(abortError ?? tx.error ?? new Error('IDB transaction aborted'));

    try {
      fn(
        tx.objectStore(FORMS_STORE),
        (value) => {
          result = value;
          resolved = true;
        },
        fail,
      );
    } catch (e) {
      fail(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/**
 * Retry an operation that was rejected by a transient IDB error
 * (transaction abort under contention, in-flight tx in another tab,
 * quota pressure that may clear). Logical errors that retrying cannot
 * fix — currently {@link FormConflictError} — bypass the retry loop and
 * surface immediately so the caller can switch to a conflict UI.
 */
async function withRetry<T>(op: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_BACKOFFS_MS.length; attempt++) {
    try {
      return await op();
    } catch (err) {
      if (err instanceof FormConflictError) throw err;
      lastErr = err;
      const backoff = RETRY_BACKOFFS_MS[attempt];
      if (backoff === undefined) break;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function notifyChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** Event name fired after every successful mutation; subscribe from hooks. */
export const FORMS_CHANGED_EVENT = CHANGE_EVENT;

/**
 * Thrown by `formDb.save` when the on-disk record's `rev` has advanced
 * past the `expectedRev` the caller passed in — i.e. another tab (or an
 * unflushed concurrent write) committed in between. The caller should
 * stop auto-saving and surface a "this form was modified elsewhere"
 * banner so the user can choose to reload.
 */
export class FormConflictError extends Error {
  constructor(
    public readonly id: string,
    public readonly expectedRev: number,
    public readonly actualRev: number,
  ) {
    super(
      `form ${id} was modified in another tab (expected rev ${expectedRev}, found ${actualRev})`,
    );
    this.name = 'FormConflictError';
  }
}

export interface SaveOptions {
  /**
   * Rev the caller last observed. If the on-disk record's rev is greater,
   * the save is rejected with {@link FormConflictError} and the on-disk
   * record is preserved. Omit to force-overwrite (used by initial create
   * and migrations).
   */
  expectedRev?: number;
}

export interface SaveResult {
  /** New rev stored on the record. Caller should track this for the next save. */
  rev: number;
}

export const formDb = {
  async getAll(): Promise<StoredForm[]> {
    const db = await getDb();
    return withRetry(() => read<StoredForm[]>(db, (store) => store.getAll()));
  },

  async getById(id: string): Promise<StoredForm | undefined> {
    const db = await getDb();
    return withRetry(() => read<StoredForm | undefined>(db, (store) => store.get(id)));
  },

  /**
   * Persist a form. If `options.expectedRev` is provided, the save runs
   * inside a single transaction that first reads the current record and
   * compares revs; this gives atomic optimistic concurrency control
   * across tabs (IDB transactions are per-origin serialized).
   */
  async save(form: StoredForm, options: SaveOptions = {}): Promise<SaveResult> {
    const db = await getDb();
    return withRetry(() =>
      writeTx<SaveResult>(db, (store, done, fail) => {
        const getReq = store.get(form.id);
        getReq.onsuccess = () => {
          const existing = getReq.result as StoredForm | undefined;
          const currentRev = existing?.rev ?? 0;
          if (options.expectedRev !== undefined && currentRev > options.expectedRev) {
            fail(new FormConflictError(form.id, options.expectedRev, currentRev));
            return;
          }
          const nextRev = currentRev + 1;
          const next: StoredForm = { ...form, rev: nextRev };
          const putReq = store.put(next);
          putReq.onsuccess = () => done({ rev: nextRev });
          putReq.onerror = () => fail(putReq.error ?? new Error('IDB put failed'));
        };
        getReq.onerror = () => fail(getReq.error ?? new Error('IDB get failed'));
      }),
    );
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await withRetry(() =>
      writeTx<void>(db, (store, done, fail) => {
        const req = store.delete(id);
        req.onsuccess = () => done(undefined);
        req.onerror = () => fail(req.error ?? new Error('IDB delete failed'));
      }),
    );
  },
} as const;
