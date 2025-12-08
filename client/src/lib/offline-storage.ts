/**
 * Offline Storage Utility for Pulse Farm Management PWA
 * 
 * Uses IndexedDB for persistent offline storage with automatic sync
 */

const DB_NAME = 'PulseFarmDB';
const DB_VERSION = 2;

// Store names
const STORES = {
  ANIMALS: 'animals',
  TREATMENTS: 'treatments',
  PASTURES: 'pastures',
  MILK_RECORDS: 'milkRecords',
  PENDING_ACTIONS: 'pendingActions',
  CACHE_METADATA: 'cacheMetadata',
  USER_PREFERENCES: 'userPreferences',
};

interface PendingAction {
  id: string;
  timestamp: number;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body: any;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
}

interface CacheMetadata {
  key: string;
  lastUpdated: number;
  expiresAt: number;
  version: number;
}

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORES.ANIMALS)) {
          const animalsStore = db.createObjectStore(STORES.ANIMALS, { keyPath: 'id' });
          animalsStore.createIndex('tagId', 'tagId', { unique: true });
          animalsStore.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.TREATMENTS)) {
          const treatmentsStore = db.createObjectStore(STORES.TREATMENTS, { keyPath: 'id' });
          treatmentsStore.createIndex('animalId', 'animalId', { unique: false });
          treatmentsStore.createIndex('date', 'date', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.PASTURES)) {
          const pasturesStore = db.createObjectStore(STORES.PASTURES, { keyPath: 'id' });
          pasturesStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.MILK_RECORDS)) {
          const milkStore = db.createObjectStore(STORES.MILK_RECORDS, { keyPath: 'id' });
          milkStore.createIndex('date', 'date', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
          const pendingStore = db.createObjectStore(STORES.PENDING_ACTIONS, { keyPath: 'id' });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
          pendingStore.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.CACHE_METADATA)) {
          db.createObjectStore(STORES.CACHE_METADATA, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.USER_PREFERENCES)) {
          db.createObjectStore(STORES.USER_PREFERENCES, { keyPath: 'key' });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get a record by ID
   */
  async get<T>(storeName: string, id: string): Promise<T | undefined> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all records from a store
   */
  async getAll<T>(storeName: string): Promise<T[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get records by index
   */
  async getByIndex<T>(storeName: string, indexName: string, value: any): Promise<T[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Put a record (add or update)
   */
  async put<T>(storeName: string, data: T): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Put multiple records
   */
  async putMany<T>(storeName: string, items: T[]): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      items.forEach(item => store.put(item));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Delete a record
   */
  async delete(storeName: string, id: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all records from a store
   */
  async clear(storeName: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Count records in a store
   */
  async count(storeName: string): Promise<number> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ============ Specialized Methods ============

  /**
   * Cache animals for offline use
   */
  async cacheAnimals(animals: any[]): Promise<void> {
    await this.putMany(STORES.ANIMALS, animals);
    await this.updateCacheMetadata(STORES.ANIMALS);
  }

  /**
   * Get cached animals
   */
  async getCachedAnimals(): Promise<any[]> {
    return this.getAll(STORES.ANIMALS);
  }

  /**
   * Cache treatments for offline use
   */
  async cacheTreatments(treatments: any[]): Promise<void> {
    await this.putMany(STORES.TREATMENTS, treatments);
    await this.updateCacheMetadata(STORES.TREATMENTS);
  }

  /**
   * Get treatments for an animal
   */
  async getAnimalTreatments(animalId: string): Promise<any[]> {
    return this.getByIndex(STORES.TREATMENTS, 'animalId', animalId);
  }

  /**
   * Add a pending action for offline sync
   */
  async addPendingAction(action: Omit<PendingAction, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
    const id = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const pendingAction: PendingAction = {
      ...action,
      id,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    await this.put(STORES.PENDING_ACTIONS, pendingAction);
    return id;
  }

  /**
   * Get all pending actions
   */
  async getPendingActions(): Promise<PendingAction[]> {
    const actions = await this.getAll<PendingAction>(STORES.PENDING_ACTIONS);
    return actions.filter(a => a.status === 'pending').sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Update pending action status
   */
  async updatePendingAction(id: string, updates: Partial<PendingAction>): Promise<void> {
    const action = await this.get<PendingAction>(STORES.PENDING_ACTIONS, id);
    if (action) {
      await this.put(STORES.PENDING_ACTIONS, { ...action, ...updates });
    }
  }

  /**
   * Remove a pending action
   */
  async removePendingAction(id: string): Promise<void> {
    await this.delete(STORES.PENDING_ACTIONS, id);
  }

  /**
   * Sync pending actions when online
   */
  async syncPendingActions(): Promise<{ success: number; failed: number }> {
    const actions = await this.getPendingActions();
    let success = 0;
    let failed = 0;

    for (const action of actions) {
      try {
        await this.updatePendingAction(action.id, { status: 'syncing' });

        const response = await fetch(action.endpoint, {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.body),
        });

        if (response.ok) {
          await this.removePendingAction(action.id);
          success++;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to sync action:', action.id, error);
        await this.updatePendingAction(action.id, {
          status: 'pending',
          retryCount: action.retryCount + 1,
        });
        failed++;
      }
    }

    // Update last sync time
    localStorage.setItem('lastSync', new Date().toISOString());

    return { success, failed };
  }

  /**
   * Update cache metadata
   */
  private async updateCacheMetadata(key: string): Promise<void> {
    const metadata: CacheMetadata = {
      key,
      lastUpdated: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      version: DB_VERSION,
    };
    await this.put(STORES.CACHE_METADATA, metadata);
  }

  /**
   * Check if cache is stale
   */
  async isCacheStale(key: string): Promise<boolean> {
    const metadata = await this.get<CacheMetadata>(STORES.CACHE_METADATA, key);
    if (!metadata) return true;
    return Date.now() > metadata.expiresAt;
  }

  /**
   * Get cache age in minutes
   */
  async getCacheAge(key: string): Promise<number | null> {
    const metadata = await this.get<CacheMetadata>(STORES.CACHE_METADATA, key);
    if (!metadata) return null;
    return Math.round((Date.now() - metadata.lastUpdated) / 60000);
  }

  /**
   * Save user preference
   */
  async setPreference(key: string, value: any): Promise<void> {
    await this.put(STORES.USER_PREFERENCES, { key, value });
  }

  /**
   * Get user preference
   */
  async getPreference<T>(key: string): Promise<T | undefined> {
    const pref = await this.get<{ key: string; value: T }>(STORES.USER_PREFERENCES, key);
    return pref?.value;
  }
}

// Export singleton instance
export const offlineStorage = new OfflineStorage();

// Export store names for external use
export { STORES };

// Export types
export type { PendingAction, CacheMetadata };
