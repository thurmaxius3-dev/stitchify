/**
 * db.ts — IndexedDB persistence layer for Stitchify.
 *
 * Stores full project snapshots (pattern matrix + doneStitches + metadata).
 * Used for local auto-save. Cloud sync is handled separately via Supabase.
 */

const DB_NAME = 'stitchify';
const DB_VERSION = 2;          // bumped for journal_entries store
const STORE_PROJECTS = 'projects';
const STORE_META = 'meta';
const STORE_JOURNAL = 'journal_entries';

// ─── Journal types ────────────────────────────────────────────────────────────
export interface JournalEntry {
  id: string;          // generated
  projectId: string;   // which project this belongs to
  blob: Blob;          // photo (JPEG, compressed)
  caption: string;
  takenAt: number;     // Date.now()
  progress: number;    // project progress % at time of capture (0-100)
}

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
      // Guard: never abort the upgrade — just create whatever is missing
      try {
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          const store = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
        // v2: journal entries store
        if (!db.objectStoreNames.contains(STORE_JOURNAL)) {
          const js = db.createObjectStore(STORE_JOURNAL, { keyPath: 'id' });
          js.createIndex('projectId', 'projectId');
          js.createIndex('takenAt',   'takenAt');
        }
      } catch (upgradeErr) {
        console.error('[Stitchify] IDB upgrade error (non-fatal):', upgradeErr);
      }
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      // Listen for version-change events (another tab opened a newer version)
      _db.onversionchange = () => { _db?.close(); _db = null; };
      resolve(_db);
    };
    req.onerror   = () => reject(req.error);
    req.onblocked = () => console.warn('[Stitchify] IDB open blocked — close other tabs');
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

export async function renameProject(id: string, newName: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_PROJECTS, 'readwrite');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const project: SavedProject | undefined = getReq.result;
      if (!project) { resolve(); return; }
      project.name = newName;
      project.updatedAt = Date.now();
      const putReq = store.put(project);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
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

// ─── Journal CRUD ─────────────────────────────────────────────────────────────────

export async function saveJournalEntry(entry: JournalEntry): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_JOURNAL, 'readwrite');
    const req = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror  = () => reject(req.error);
  });
}

export async function loadJournalEntries(projectId: string): Promise<JournalEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_JOURNAL, 'readonly');
    const idx   = store.index('projectId');
    const req   = idx.getAll(IDBKeyRange.only(projectId));
    req.onsuccess = () => {
      const results: JournalEntry[] = req.result ?? [];
      resolve(results.sort((a, b) => b.takenAt - a.takenAt)); // newest first
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_JOURNAL, 'readwrite');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror  = () => reject(req.error);
  });
}

export async function countJournalEntries(projectId: string): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_JOURNAL, 'readonly');
    const req = store.index('projectId').count(IDBKeyRange.only(projectId));
    req.onsuccess = () => resolve(req.result ?? 0);
    req.onerror  = () => reject(req.error);
  });
}
