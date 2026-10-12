/**
 * store.js — local-first persistence.
 *
 * The first law of a 1% world is that the network is not there. So nothing may
 * depend on it: the outbox lives on the device, survives a reload, and is
 * drained whenever a link happens to exist.
 *
 * IndexedDB when available, an in-memory shim when it is not (private windows,
 * file:// previews). The rest of the app cannot tell the difference.
 */

const DB_NAME = "wick";
const DB_VERSION = 2;
export const STORES = ["outbox", "archive", "ledger", "meta", "inbox"];

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

class MemoryStore {
  constructor() {
    this.maps = new Map(STORES.map((s) => [s, new Map()]));
    this.kind = "memory";
  }
  async put(store, value, key = value.id) {
    this.maps.get(store).set(key, value);
    return key;
  }
  async get(store, key) {
    return this.maps.get(store).get(key);
  }
  async all(store) {
    return [...this.maps.get(store).values()];
  }
  async remove(store, key) {
    this.maps.get(store).delete(key);
  }
  async clear(store) {
    this.maps.get(store).clear();
  }
  async complete(items) {
    for (const item of items) {
      this.maps.get("archive").set(item.id, structuredClone(item));
      this.maps.get("outbox").delete(item.id);
    }
  }
}

class IdbStore {
  constructor(db) {
    this.db = db;
    this.kind = "indexeddb";
  }
  #tx(store, mode) {
    return this.db.transaction(store, mode).objectStore(store);
  }
  async put(store, value, key = value.id) {
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, "readwrite");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("write failed"));
      tx.onabort = () => reject(tx.error || new Error("write aborted"));
      tx.objectStore(store).put(value, key);
    });
    return key;
  }
  async get(store, key) {
    return promisify(this.#tx(store, "readonly").get(key));
  }
  async all(store) {
    return promisify(this.#tx(store, "readonly").getAll());
  }
  async remove(store, key) {
    await promisify(this.#tx(store, "readwrite").delete(key));
  }
  async clear(store) {
    await promisify(this.#tx(store, "readwrite").clear());
  }
  async complete(items) {
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction(["outbox", "archive"], "readwrite");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("archive transaction failed"));
      tx.onabort = () => reject(tx.error || new Error("archive transaction aborted"));
      for (const item of items) {
        tx.objectStore("archive").put(item, item.id);
        tx.objectStore("outbox").delete(item.id);
      }
    });
  }
}

let instance = null;

/** A blocked or hanging IndexedDB must never stall the interface. */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("indexeddb timeout")), ms)),
  ]);
}

export async function openStore() {
  if (instance) return instance;
  if (typeof indexedDB === "undefined") {
    instance = new MemoryStore();
    return instance;
  }
  try {
    const db = await withTimeout(
      new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          for (const name of STORES) {
            if (!database.objectStoreNames.contains(name)) {
              database.createObjectStore(name);
            }
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("indexeddb blocked"));
      }),
      2500,
    );
    instance = new IdbStore(db);
  } catch {
    instance = new MemoryStore();
  }
  return instance;
}

/** Stable, sortable id without a dependency. */
export function newId(prefix = "m") {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${rand}`;
}
