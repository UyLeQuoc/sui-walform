import type { WalrusSiteManifest } from '../../sui/tx/walrus-site';

/**
 * Persistent cache for partially-completed builder-site deploys.
 *
 * Three checkpoints during a deploy can fail independently and waste WAL/SUI
 * if forced to restart from scratch:
 *
 *   1. Walrus blob upload (WAL spent → manifest produced).
 *   2. First Sui PTB (Site object created, transferred to user, ~150 files added).
 *   3. Subsequent Sui PTBs (remaining files + routes table added).
 *
 * Saving after each successful checkpoint lets the UI offer "Resume" so the
 * user only pays for the steps still pending. Gated on the signer's address
 * — switching wallets invalidates the resume option (the Site is owned by
 * the original wallet and only that wallet can mutate it).
 *
 * Single-key store: there's only ever one builder deploy in flight per
 * browser origin. Entries auto-expire at 24h; storage epochs are well beyond
 * that so a resume tx still resolves valid blobs.
 */

const DB_NAME = 'walform-builder-site-cache';
const DB_VERSION = 1;
const STORE = 'pending-deploys';
const TTL_MS = 24 * 60 * 60 * 1000;
const SINGLE_KEY = 'singleton';

export interface PendingBuilderDeploy {
  /** Always `SINGLE_KEY` — only one deploy in flight at a time. */
  id: string;
  manifest: WalrusSiteManifest;
  /** Sui digest of the Walrus registration tx. */
  walrusUploadDigest: string;
  network: 'testnet' | 'mainnet';
  /** Address that paid for the Walrus upload — gates resume eligibility. */
  signer: string;
  /** Set once chunk 1 (Site creation + transfer) completes. */
  siteObjectId?: string;
  /** Number of Sui PTB chunks that have already executed (0…chunkCount). */
  chunksCompleted: number;
  /** Total chunks the manifest was split into. */
  chunkCount: number;
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
        db.createObjectStore(STORE, { keyPath: 'id' });
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

function isFresh(entry: PendingBuilderDeploy): boolean {
  return Date.now() - entry.createdAt < TTL_MS;
}

export const builderSiteCache = {
  async put(entry: Omit<PendingBuilderDeploy, 'id' | 'createdAt'>): Promise<void> {
    const db = await getDb();
    const existing = await read<PendingBuilderDeploy | undefined>(db, (s) => s.get(SINGLE_KEY));
    const next: PendingBuilderDeploy = {
      ...entry,
      id: SINGLE_KEY,
      // Preserve original createdAt across updates so TTL is from the first
      // checkpoint, not the most recent one — prevents an indefinitely-old
      // resume from looking fresh.
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await write(db, (s) => s.put(next));
  },

  async get(): Promise<PendingBuilderDeploy | null> {
    const db = await getDb();
    const entry = await read<PendingBuilderDeploy | undefined>(db, (s) => s.get(SINGLE_KEY));
    if (!entry) return null;
    if (!isFresh(entry)) {
      void this.clear().catch(() => {});
      return null;
    }
    return entry;
  },

  async clear(): Promise<void> {
    const db = await getDb();
    await write(db, (s) => s.delete(SINGLE_KEY) as IDBRequest);
  },
} as const;
