import type { WalrusSiteManifest } from '../../sui/tx/walrus-site';

/**
 * Persistent cache for partially-completed Walrus Site deploys.
 *
 * Walrus blob upload (signed by user wallet, costs WAL) lands chain-side
 * BEFORE the atomic Sui PTB that creates the Site object + mirrors onto the
 * Form. If the user rejects / network drops the Sui PTB, the Walrus storage
 * reservation is already paid for — re-running the full deploy would charge
 * WAL twice for the same files.
 *
 * This cache stores the freshly-uploaded manifest under the form's id so the
 * "Resume Walrus deploy" branch in `<DeployToWalrusSiteButton>` can skip
 * straight to the Sui PTB on retry.
 *
 * Entries auto-expire at 24h; storage epochs (5) are well beyond that so a
 * stale resume tx still resolves valid blobs.
 */

const DB_NAME = 'walform-site-cache';
const DB_VERSION = 1;
const STORE = 'pending-deploys';
const TTL_MS = 24 * 60 * 60 * 1000;

export interface PendingSiteDeploy {
  formId: string;
  manifest: WalrusSiteManifest;
  /** Sui digest of the Walrus blob registration tx. Surfaced for debugging. */
  walrusUploadDigest: string;
  createdAt: number;
}

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
        db.createObjectStore(STORE, { keyPath: 'formId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(new Error(`Failed to open ${DB_NAME}: ${req.error?.message ?? 'unknown error'}`));
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error(`${DB_NAME} open was blocked by another tab`));
    };
  });

  return dbPromise;
}

function read<T>(db: IDBDatabase, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = fn(tx.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function write(db: IDBDatabase, fn: (store: IDBObjectStore) => IDBRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const r = fn(tx.objectStore(STORE));
      r.onerror = () => reject(r.error ?? new Error('IDB request failed'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IDB transaction aborted'));
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

function isFresh(entry: PendingSiteDeploy): boolean {
  return Date.now() - entry.createdAt < TTL_MS;
}

export const formSiteCache = {
  async put(
    formId: string,
    manifest: WalrusSiteManifest,
    walrusUploadDigest: string,
  ): Promise<void> {
    const db = await getDb();
    const entry: PendingSiteDeploy = {
      formId,
      manifest,
      walrusUploadDigest,
      createdAt: Date.now(),
    };
    await write(db, (s) => s.put(entry));
  },

  async get(formId: string): Promise<PendingSiteDeploy | null> {
    const db = await getDb();
    const entry = await read<PendingSiteDeploy | undefined>(db, (s) => s.get(formId));
    if (!entry) return null;
    if (!isFresh(entry)) {
      // Best-effort cleanup; ignore failures.
      void this.delete(formId).catch(() => {});
      return null;
    }
    return entry;
  },

  async delete(formId: string): Promise<void> {
    const db = await getDb();
    await write(db, (s) => s.delete(formId) as IDBRequest);
  },

  async clearStale(): Promise<number> {
    const db = await getDb();
    const all = await read<PendingSiteDeploy[]>(db, (s) => s.getAll());
    const stale = all.filter((e) => !isFresh(e));
    for (const e of stale) {
      await write(db, (s) => s.delete(e.formId) as IDBRequest);
    }
    return stale.length;
  },
} as const;
