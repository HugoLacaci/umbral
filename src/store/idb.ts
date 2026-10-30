/** Almacenamiento async para zustand/persist sobre IndexedDB (cae a localStorage si no hay IDB). */
import type { StateStorage } from 'zustand/middleware';

const DB = 'umbral';
const STORE = 'kv';

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp)
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const r = fn(t.objectStore(STORE));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

const hasIdb = typeof indexedDB !== 'undefined';

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    if (!hasIdb) return localStorage.getItem(name);
    try {
      return ((await tx('readonly', (s) => s.get(name))) as string | undefined) ?? null;
    } catch {
      return localStorage.getItem(name);
    }
  },
  setItem: async (name, value) => {
    if (!hasIdb) return localStorage.setItem(name, value);
    try {
      await tx('readwrite', (s) => s.put(value, name));
    } catch {
      localStorage.setItem(name, value);
    }
  },
  removeItem: async (name) => {
    if (!hasIdb) return localStorage.removeItem(name);
    await tx('readwrite', (s) => s.delete(name));
  },
};
