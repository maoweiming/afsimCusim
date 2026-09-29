/**
 * 通用 IndexedDB 封装
 * 提供类型安全的异步 CRUD 操作
 */

const DB_NAME = 'truesim';
const DB_VERSION = 1;

export class IndexedDBStore {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    private stores: Array<{ name: string; keyPath: string; indexes?: Array<{ name: string; keyPath: string; unique?: boolean }> }> = [],
  ) {}

  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const store of this.stores) {
          if (!db.objectStoreNames.contains(store.name)) {
            const objectStore = db.createObjectStore(store.name, { keyPath: store.keyPath });
            for (const index of store.indexes ?? []) {
              objectStore.createIndex(index.name, index.keyPath, { unique: index.unique });
            }
          }
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`IndexedDB open failed: ${request.error?.message}`));
      };
    });

    await this.initPromise;
  }

  async put<T>(storeName: string, data: T): Promise<void> {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Put failed: ${request.error?.message}`));
    });
  }

  async putBatch<T>(storeName: string, items: T[]): Promise<void> {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(`PutBatch failed: ${tx.error?.message}`));
    });
  }

  async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(new Error(`Get failed: ${request.error?.message}`));
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(new Error(`GetAll failed: ${request.error?.message}`));
    });
  }

  async query<T>(storeName: string, indexName: string, range: IDBKeyRange): Promise<T[]> {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(new Error(`Query failed: ${request.error?.message}`));
    });
  }

  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Delete failed: ${request.error?.message}`));
    });
  }

  async clear(storeName: string): Promise<void> {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Clear failed: ${request.error?.message}`));
    });
  }

  async count(storeName: string): Promise<number> {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Count failed: ${request.error?.message}`));
    });
  }
}

// ============ 预配置实例 ============

export const eventDB = new IndexedDBStore([
  {
    name: 'events',
    keyPath: 'id',
    indexes: [
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'category', keyPath: 'category' },
      { name: 'wallTime', keyPath: 'wallTime' },
      { name: 'simId', keyPath: 'simId' },
    ],
  },
]);
