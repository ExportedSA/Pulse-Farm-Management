// Offline storage utility using IndexedDB
interface OfflineAction {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
}

interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  expiry?: number;
}

class OfflineStorage {
  private dbName = 'PulseOfflineDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store for pending actions
        if (!db.objectStoreNames.contains('pendingActions')) {
          const actionStore = db.createObjectStore('pendingActions', { keyPath: 'id' });
          actionStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store for cached data
        if (!db.objectStoreNames.contains('cachedData')) {
          const cacheStore = db.createObjectStore('cachedData', { keyPath: 'key' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
          cacheStore.createIndex('expiry', 'expiry', { unique: false });
        }

        // Store for user preferences
        if (!db.objectStoreNames.contains('userPrefs')) {
          db.createObjectStore('userPrefs', { keyPath: 'key' });
        }
      };
    });
  }

  // Store pending actions for background sync
  async addPendingAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    if (!this.db) await this.init();

    const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullAction: OfflineAction = {
      ...action,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingActions'], 'readwrite');
      const store = transaction.objectStore('pendingActions');
      const request = store.add(fullAction);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all pending actions
  async getPendingActions(): Promise<OfflineAction[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingActions'], 'readonly');
      const store = transaction.objectStore('pendingActions');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Remove a pending action
  async removePendingAction(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingActions'], 'readwrite');
      const store = transaction.objectStore('pendingActions');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Cache data for offline use
  async cacheData(key: string, data: any, ttlMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) await this.init();

    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttlMs,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cachedData'], 'readwrite');
      const store = transaction.objectStore('cachedData');
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get cached data
  async getCachedData(key: string): Promise<any | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cachedData'], 'readonly');
      const store = transaction.objectStore('cachedData');
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result;
        if (!entry) return resolve(null);

        // Check if expired
        if (entry.expiry && Date.now() > entry.expiry) {
          this.removeCachedData(key); // Clean up expired entry
          return resolve(null);
        }

        resolve(entry.data);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Remove cached data
  async removeCachedData(key: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cachedData'], 'readwrite');
      const store = transaction.objectStore('cachedData');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Clean up expired cached data
  async cleanExpiredCache(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cachedData'], 'readwrite');
      const store = transaction.objectStore('cachedData');
      const index = store.index('expiry');
      const request = index.openCursor(IDBKeyRange.upperBound(Date.now()));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Store user preferences
  async setUserPref(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userPrefs'], 'readwrite');
      const store = transaction.objectStore('userPrefs');
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get user preferences
  async getUserPref(key: string): Promise<any | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userPrefs'], 'readonly');
      const store = transaction.objectStore('userPrefs');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get storage usage statistics
  async getStorageStats(): Promise<{
    pendingActions: number;
    cachedData: number;
    userPrefs: number;
    estimatedSize: string;
  }> {
    if (!this.db) await this.init();

    const [pendingActions, cachedData, userPrefs] = await Promise.all([
      this.getCount('pendingActions'),
      this.getCount('cachedData'),
      this.getCount('userPrefs'),
    ]);

    // Estimate storage size (rough approximation)
    const estimatedSize = this.formatBytes(
      (pendingActions + cachedData + userPrefs) * 1024 // Assume ~1KB per entry
    );

    return {
      pendingActions,
      cachedData,
      userPrefs,
      estimatedSize,
    };
  }

  // Clear all offline data
  async clearAllData(): Promise<void> {
    if (!this.db) await this.init();

    const stores = ['pendingActions', 'cachedData', 'userPrefs'];
    
    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  // Helper methods
  private async getCount(storeName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export singleton instance
export const offlineStorage = new OfflineStorage();

// Network status utilities
export const networkStatus = {
  isOnline: navigator.onLine,
  
  init() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.triggerSync();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  },
  
  async triggerSync() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      // Type assertion for sync API
      const reg = registration as any;
      if (reg.sync) {
        await reg.sync.register('background-sync');
      }
    }
  },
  
  waitForConnection(timeout = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isOnline) {
        resolve(true);
        return;
      }
      
      const timer = setTimeout(() => resolve(false), timeout);
      
      const checkConnection = () => {
        if (this.isOnline) {
          clearTimeout(timer);
          window.removeEventListener('online', checkConnection);
          resolve(true);
        }
      };
      
      window.addEventListener('online', checkConnection);
    });
  },
};

// Initialize network status monitoring
networkStatus.init();
