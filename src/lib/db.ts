/**
 * db.ts — IndexedDB persistence layer for Stitchify.
 *
 * Stores full project snapshots (pattern matrix + doneStitches + metadata).
 * Used for local auto-save. Cloud sync is handled separately via Supabase.
 */

const DB_NAME = 'stitchify';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_META = 'meta';

export interface SavedProject {
  id: string;               // uuid
  name: string;
  width: number;
  height: number;
  colorSystem: string;
  colorCount: number;
  progress: number;
  stitched: number;
  total: number;
  matrix: number[];         // serialised Uint16Array
  doneMatrix: number[];     // serialised Uint8Array
  activeDmcIndices: number[] | null;
  originX: number;
  originY: number;
  updatedAt: number;        // Date.now()
  syncedAt: number | null;  // last successful cloud push
}

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const store = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

function tx(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode
): IDBObjectStore {
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function saveProject(project: SavedProject): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_PROJECTS, 'readwrite');
    const req = store.put(project);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadAllProjects(): Promise<SavedProject[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_PROJECTS, 'readonly');
    const req = store.index('updatedAt').getAll();
    req.onsuccess = () => {
      const results: SavedProject[] = req.result ?? [];
      // newest first
      resolve(results.sort((a, b) => b.updatedAt - a.updatedAt));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function loadProject(id: string): Promise<SavedProject | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_PROJECTS, 'readonly');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_PROJECTS, 'readwrite');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getLastOpenProjectId(): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_META, 'readonly');
    const req = store.get('lastOpenProjectId');
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function setLastOpenProjectId(id: string | null): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_META, 'readwrite');
    const req = id ? store.put(id, 'lastOpenProjectId') : store.delete('lastOpenProjectId');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
