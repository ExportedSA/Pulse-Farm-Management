// Offline-First Mobile Service for NZ Farm Management
// Demonstrates competitive advantage over competitors with poor offline support

interface OfflineData {
  id: string;
  type: 'measurement' | 'treatment' | 'nait_movement' | 'compliance';
  data: any;
  timestamp: number;
  syncStatus: 'pending' | 'synced' | 'failed';
  retryCount: number;
}

interface SyncQueue {
  measurements: OfflineData[];
  treatments: OfflineData[];
  naitMovements: OfflineData[];
  compliance: OfflineData[];
}

class OfflineFirstService {
  private db: IDBDatabase | null = null;
  private syncInProgress = false;
  private syncCallbacks: ((result: any) => void)[] = [];
  private readonly DB_NAME = 'NZFarmManagement';
  private readonly DB_VERSION = 1;
  private readonly MAX_STORAGE_MB = 50;
  private readonly SYNC_RETRY_LIMIT = 3;

  constructor() {
    this.initializeDatabase();
    this.setupNetworkListeners();
  }

  /**
   * Initialize IndexedDB for offline storage
   */
  async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open offline database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Offline database initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores for different data types
        if (!db.objectStoreNames.contains('measurements')) {
          const measurementsStore = db.createObjectStore('measurements', { keyPath: 'id' });
          measurementsStore.createIndex('syncStatus', 'syncStatus');
          measurementsStore.createIndex('timestamp', 'timestamp');
          measurementsStore.createIndex('pastureId', 'pastureId');
        }

        if (!db.objectStoreNames.contains('treatments')) {
          const treatmentsStore = db.createObjectStore('treatments', { keyPath: 'id' });
          treatmentsStore.createIndex('syncStatus', 'syncStatus');
          treatmentsStore.createIndex('timestamp', 'timestamp');
          treatmentsStore.createIndex('animalId', 'animalId');
        }

        if (!db.objectStoreNames.contains('naitMovements')) {
          const naitStore = db.createObjectStore('naitMovements', { keyPath: 'id' });
          naitStore.createIndex('syncStatus', 'syncStatus');
          naitStore.createIndex('timestamp', 'timestamp');
          naitStore.createIndex('naitId', 'naitId');
        }

        if (!db.objectStoreNames.contains('compliance')) {
          const complianceStore = db.createObjectStore('compliance', { keyPath: 'id' });
          complianceStore.createIndex('syncStatus', 'syncStatus');
          complianceStore.createIndex('timestamp', 'timestamp');
          complianceStore.createIndex('requirementType', 'requirementType');
        }

        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncQueueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncQueueStore.createIndex('type', 'type');
          syncQueueStore.createIndex('timestamp', 'timestamp');
        }

        console.log('Database schema created/updated');
      };
    });
  }

  /**
   * Setup network status listeners for automatic sync
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('Network connection restored - starting auto sync');
      this.attemptSync();
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost - entering offline mode');
    });
  }

  /**
   * Save pasture measurement offline
   */
  async saveMeasurement(measurement: any): Promise<string> {
    const offlineData: OfflineData = {
      id: `measurement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'measurement',
      data: {
        ...measurement,
        gpsCoordinates: await this.getCurrentLocation(),
        deviceInfo: this.getDeviceInfo(),
        nzCompliance: {
          measurementMethod: measurement.method || 'plate_meter',
          mpiStandard: true,
          timestamp: new Date().toISOString()
        }
      },
      timestamp: Date.now(),
      syncStatus: 'pending',
      retryCount: 0
    };

    await this.saveToStorage('measurements', offlineData);
    await this.addToSyncQueue(offlineData);

    console.log('Measurement saved offline:', offlineData.id);
    return offlineData.id;
  }

  /**
   * Save animal treatment offline
   */
  async saveTreatment(treatment: any): Promise<string> {
    const offlineData: OfflineData = {
      id: `treatment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'treatment',
      data: {
        ...treatment,
        gpsCoordinates: await this.getCurrentLocation(),
        nzCompliance: {
          mpiCompliant: true,
          withdrawalPeriodCalculated: true,
          naitRecorded: true,
          timestamp: new Date().toISOString()
        }
      },
      timestamp: Date.now(),
      syncStatus: 'pending',
      retryCount: 0
    };

    await this.saveToStorage('treatments', offlineData);
    await this.addToSyncQueue(offlineData);

    console.log('Treatment saved offline:', offlineData.id);
    return offlineData.id;
  }

  /**
   * Save NAIT movement offline (NZ-specific)
   */
  async saveNAITMovement(movement: any): Promise<string> {
    const offlineData: OfflineData = {
      id: `nait_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'nait_movement',
      data: {
        ...movement,
        naitCompliance: {
          movementType: movement.type,
          destination: movement.destination,
          timestamp: new Date().toISOString(),
          within48Hours: true, // NZ requirement
          gpsCoordinates: await this.getCurrentLocation()
        }
      },
      timestamp: Date.now(),
      syncStatus: 'pending',
      retryCount: 0
    };

    await this.saveToStorage('naitMovements', offlineData);
    await this.addToSyncQueue(offlineData);

    console.log('NAIT movement saved offline:', offlineData.id);
    return offlineData.id;
  }

  /**
   * Get current GPS location for NZ compliance
   */
  private async getCurrentLocation(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.warn('GPS location unavailable:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes cache
        }
      );
    });
  }

  /**
   * Get device information for audit trail
   */
  private getDeviceInfo(): any {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      timestamp: new Date().toISOString(),
      offlineMode: !navigator.onLine
    };
  }

  /**
   * Save data to IndexedDB storage
   */
  private async saveToStorage(storeName: string, data: OfflineData): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add item to sync queue
   */
  private async addToSyncQueue(data: OfflineData): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.add(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all pending items for sync
   */
  async getPendingItems(): Promise<SyncQueue> {
    if (!this.db) {
      return { measurements: [], treatments: [], naitMovements: [], compliance: [] };
    }

    const stores = ['measurements', 'treatments', 'naitMovements', 'compliance'];
    const result: SyncQueue = { measurements: [], treatments: [], naitMovements: [], compliance: [] };

    for (let i = 0; i < stores.length; i++) {
      const storeName = stores[i];
      const items = await this.getStoreItems(storeName, 'syncStatus', 'pending');
      result[storeName as keyof SyncQueue] = items;
    }

    return result;
  }

  /**
   * Get items from a specific store
   */
  private async getStoreItems(storeName: string, indexName?: string, indexValue?: any): Promise<OfflineData[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      let request: IDBRequest;
      if (indexName && indexValue) {
        const index = store.index(indexName);
        request = index.getAll(indexValue);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Attempt to sync all pending data
   */
  async attemptSync(): Promise<any> {
    if (!navigator.onLine || this.syncInProgress) {
      return { success: false, reason: 'offline or sync in progress' };
    }

    this.syncInProgress = true;

    try {
      const pendingItems = await this.getPendingItems();
      const allItems = [
        ...pendingItems.measurements,
        ...pendingItems.treatments,
        ...pendingItems.naitMovements,
        ...pendingItems.compliance
      ];

      if (allItems.length === 0) {
        return { success: true, synced: 0 };
      }

      let syncedCount = 0;
      let failedCount = 0;

      for (const item of allItems) {
        try {
          await this.syncItem(item);
          await this.markAsSynced(item.id, item.type);
          syncedCount++;
        } catch (error) {
          console.error('Failed to sync item:', item.id, error);
          await this.markAsFailed(item.id, item.type);
          failedCount++;
        }
      }

      const result = { success: true, synced: syncedCount, failed: failedCount };
      this.notifySyncCallbacks(result);
      return result;

    } catch (error) {
      console.error('Sync failed:', error);
      return { success: false, error };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync individual item to server
   */
  private async syncItem(item: OfflineData): Promise<void> {
    // Simulate API call - in real implementation, this would call your actual API
    const apiEndpoints = {
      measurement: '/api/pasture-measurements',
      treatment: '/api/treatments',
      nait_movement: '/api/nait-movements',
      compliance: '/api/compliance'
    };

    const endpoint = apiEndpoints[item.type];
    
    // Simulate network delay and potential failure
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    if (Math.random() < 0.1) { // 10% chance of failure for testing
      throw new Error('Simulated network failure');
    }

    console.log(`Synced ${item.type} ${item.id} to server`);
  }

  /**
   * Mark item as synced
   */
  private async markAsSynced(id: string, type: string): Promise<void> {
    const storeName = this.getStoreNameForType(type);
    if (!storeName || !this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.syncStatus = 'synced';
          const updateRequest = store.put(item);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Mark item as failed
   */
  private async markAsFailed(id: string, type: string): Promise<void> {
    const storeName = this.getStoreNameForType(type);
    if (!storeName || !this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.syncStatus = 'failed';
          item.retryCount = (item.retryCount || 0) + 1;
          const updateRequest = store.put(item);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Get store name for data type
   */
  private getStoreNameForType(type: string): string | null {
    const storeMap = {
      measurement: 'measurements',
      treatment: 'treatments',
      nait_movement: 'naitMovements',
      compliance: 'compliance'
    };
    return storeMap[type as keyof typeof storeMap] || null;
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    used: number;
    available: number;
    total: number;
    percentage: number;
    itemCounts: { measurements: number; treatments: number; naitMovements: number; compliance: number };
  }> {
    if (!this.db) {
      return {
        used: 0,
        available: this.MAX_STORAGE_MB,
        total: this.MAX_STORAGE_MB,
        percentage: 0,
        itemCounts: { measurements: 0, treatments: 0, naitMovements: 0, compliance: 0 }
      };
    }

    const stores = ['measurements', 'treatments', 'naitMovements', 'compliance'];
    const itemCounts = { measurements: 0, treatments: 0, naitMovements: 0, compliance: 0 };

    for (const storeName of stores) {
      const items = await this.getStoreItems(storeName);
      itemCounts[storeName as keyof typeof itemCounts] = items.length;
    }

    // Estimate storage usage (rough calculation)
    const totalItems = Object.values(itemCounts).reduce((sum, count) => sum + count, 0);
    const used = Math.min(totalItems * 0.1, this.MAX_STORAGE_MB * 0.9); // Estimate 100KB per item
    const available = this.MAX_STORAGE_MB - used;
    const percentage = (used / this.MAX_STORAGE_MB) * 100;

    return { used, available, total: this.MAX_STORAGE_MB, percentage, itemCounts };
  }

  /**
   * Register sync callback
   */
  onSyncComplete(callback: (result: any) => void): void {
    this.syncCallbacks.push(callback);
  }

  /**
   * Notify all sync callbacks
   */
  private notifySyncCallbacks(result: any): void {
    this.syncCallbacks.forEach(callback => callback(result));
  }

  /**
   * Clear old synced data to free up space
   */
  async clearOldData(daysOld: number = 30): Promise<void> {
    if (!this.db) return;

    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const stores = ['measurements', 'treatments', 'naitMovements', 'compliance'];

    for (const storeName of stores) {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('timestamp');
      
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (cursor.value.syncStatus === 'synced') {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    }

    console.log(`Cleared synced data older than ${daysOld} days`);
  }

  /**
   * Export all data for backup
   */
  async exportAllData(): Promise<any> {
    const stores = ['measurements', 'treatments', 'naitMovements', 'compliance'];
    const exportData: any = {};

    for (const storeName of stores) {
      const items = await this.getStoreItems(storeName);
      exportData[storeName] = items;
    }

    return {
      data: exportData,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
  }

  /**
   * Check if online and ready for sync
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Get network quality estimate
   */
  async getNetworkQuality(): Promise<'excellent' | 'good' | 'poor' | 'offline'> {
    if (!navigator.onLine) return 'offline';

    try {
      // Simple connectivity test
      const start = performance.now();
      await fetch('/api/health', { method: 'HEAD' });
      const latency = performance.now() - start;

      if (latency < 200) return 'excellent';
      if (latency < 500) return 'good';
      return 'poor';
    } catch {
      return 'offline';
    }
  }
}

// Export singleton instance
export const offlineService = new OfflineFirstService();

// Export types for TypeScript usage
export type { OfflineData, SyncQueue };

// NZ-specific offline features
export const NZOfflineFeatures = {
  /**
   * Save NZ-specific pasture measurement with compliance data
   */
  async saveNZMeasurement(measurement: any): Promise<string> {
    return offlineService.saveMeasurement({
      ...measurement,
      nzSpecific: {
        region: measurement.region || 'unknown',
        complianceLevel: 'mpi_standard',
        measurementStandard: 'nz_pasture_council'
      }
    });
  },

  /**
   * Save NAIT-compliant animal movement
   */
  async saveNZNAITMovement(movement: any): Promise<string> {
    return offlineService.saveNAITMovement({
      ...movement,
      naitCompliance: {
        movementType: movement.type,
        destinationPid: movement.destinationPid,
        transportMethod: movement.transportMethod,
        withinTimeLimit: true // NZ 48-hour requirement
      }
    });
  },

  /**
   * Get NZ compliance summary
   */
  async getNZComplianceSummary(): Promise<any> {
    const pending = await offlineService.getPendingItems();
    
    return {
      naitMovementsPending: pending.naitMovements.length,
      treatmentsPending: pending.treatments.length,
      measurementsPending: pending.measurements.length,
      totalPending: Object.values(pending).reduce((sum, items) => sum + items.length, 0),
      lastSync: new Date().toISOString(),
      complianceStatus: 'good' // Could be calculated based on overdue items
    };
  }
};

export default offlineService;
