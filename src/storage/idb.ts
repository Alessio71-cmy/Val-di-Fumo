/**
 * Archivio chiave-valore su IndexedDB con ripiego in memoria (navigazione privata, dati del sito bloccati, test).
 * Tutto resta sul dispositivo: nessun dato viene inviato in rete.
 */
const DB_NAME = 'vdf-trail';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, unknown>();
let usingMemory = false;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        usingMemory = true;
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        usingMemory = true;
        resolve(null);
      };
      req.onblocked = () => {
        usingMemory = true;
        resolve(null);
      };
    } catch {
      usingMemory = true;
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return memory.get(key) as T | undefined;
  try {
    return (await tx(db, 'readonly', (s) => s.get(key))) as T | undefined;
  } catch {
    return memory.get(key) as T | undefined;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  memory.set(key, value);
  const db = await openDb();
  if (!db) return;
  try {
    await tx(db, 'readwrite', (s) => s.put(value, key));
  } catch {
    usingMemory = true;
  }
}

export async function kvDel(key: string): Promise<void> {
  memory.delete(key);
  const db = await openDb();
  if (!db) return;
  try {
    await tx(db, 'readwrite', (s) => s.delete(key));
  } catch {
    /* ignora */
  }
}

/** true se le preferenze NON vengono davvero salvate sul dispositivo (ripiego in memoria). */
export async function isVolatileStorage(): Promise<boolean> {
  await openDb();
  return usingMemory;
}

/** Solo per i test. */
export function __resetStorageForTests(): void {
  dbPromise = null;
  usingMemory = false;
  memory.clear();
}
