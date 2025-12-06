import { offlineStorage, networkStatus } from './offlineStorage';

interface OfflineApiOptions {
  cacheFor?: number; // TTL in milliseconds
  retryOffline?: boolean;
  fallbackData?: any;
}

class OfflineApi {
  private defaultCacheTime = 5 * 60 * 1000; // 5 minutes

  // GET request with offline support
  async get(url: string, options: OfflineApiOptions = {}): Promise<any> {
    const { cacheFor = this.defaultCacheTime, fallbackData } = options;

    // Try cache first if offline
    if (!networkStatus.isOnline) {
      const cachedData = await offlineStorage.getCachedData(url);
      if (cachedData) {
        console.log('Offline: Using cached data for', url);
        return { ...cachedData, _offline: true, _cached: true };
      }
      
      if (fallbackData) {
        console.log('Offline: Using fallback data for', url);
        return { ...fallbackData, _offline: true, _fallback: true };
      }
      
      throw new Error('Offline: No cached data available');
    }

    try {
      // Try network request
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache successful responses
      if (cacheFor > 0) {
        await offlineStorage.cacheData(url, data, cacheFor);
      }
      
      return data;
    } catch (error) {
      console.warn('Network request failed, trying cache:', error);
      
      // Fallback to cache
      const cachedData = await offlineStorage.getCachedData(url);
      if (cachedData) {
        return { ...cachedData, _offline: true, _cached: true };
      }
      
      if (fallbackData) {
        return { ...fallbackData, _offline: true, _fallback: true };
      }
      
      throw error;
    }
  }

  // POST request with offline queuing
  async post(url: string, data: any, options: OfflineApiOptions = {}): Promise<any> {
    const { retryOffline = true } = options;

    if (!networkStatus.isOnline) {
      if (retryOffline) {
        console.log('Offline: Queuing POST request for', url);
        const actionId = await offlineStorage.addPendingAction({
          url,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        
        return {
          _offline: true,
          _queued: true,
          actionId,
          message: 'Request queued for sync when online',
        };
      }
      
      throw new Error('Offline: Cannot make POST request');
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (retryOffline) {
        console.log('Network failed, queuing POST request:', error);
        const actionId = await offlineStorage.addPendingAction({
          url,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        
        return {
          _offline: true,
          _queued: true,
          actionId,
          message: 'Request queued for sync when online',
        };
      }
      
      throw error;
    }
  }

  // PUT request with offline queuing
  async put(url: string, data: any, options: OfflineApiOptions = {}): Promise<any> {
    const { retryOffline = true } = options;

    if (!networkStatus.isOnline) {
      if (retryOffline) {
        console.log('Offline: Queuing PUT request for', url);
        const actionId = await offlineStorage.addPendingAction({
          url,
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        
        return {
          _offline: true,
          _queued: true,
          actionId,
          message: 'Request queued for sync when online',
        };
      }
      
      throw new Error('Offline: Cannot make PUT request');
    }

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (retryOffline) {
        console.log('Network failed, queuing PUT request:', error);
        const actionId = await offlineStorage.addPendingAction({
          url,
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        
        return {
          _offline: true,
          _queued: true,
          actionId,
          message: 'Request queued for sync when online',
        };
      }
      
      throw error;
    }
  }

  // DELETE request with offline queuing
  async delete(url: string, options: OfflineApiOptions = {}): Promise<any> {
    const { retryOffline = true } = options;

    if (!networkStatus.isOnline) {
      if (retryOffline) {
        console.log('Offline: Queuing DELETE request for', url);
        const actionId = await offlineStorage.addPendingAction({
          url,
          method: 'DELETE',
          headers: {},
        });
        
        return {
          _offline: true,
          _queued: true,
          actionId,
          message: 'Request queued for sync when online',
        };
      }
      
      throw new Error('Offline: Cannot make DELETE request');
    }

    try {
      const response = await fetch(url, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (retryOffline) {
        console.log('Network failed, queuing DELETE request:', error);
        const actionId = await offlineStorage.addPendingAction({
          url,
          method: 'DELETE',
          headers: {},
        });
        
        return {
          _offline: true,
          _queued: true,
          actionId,
          message: 'Request queued for sync when online',
        };
      }
      
      throw error;
    }
  }

  // Sync pending actions
  async syncPendingActions(): Promise<{
    successful: number;
    failed: number;
    remaining: number;
  }> {
    const pendingActions = await offlineStorage.getPendingActions();
    
    let successful = 0;
    let failed = 0;

    for (const action of pendingActions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body,
        });

        if (response.ok) {
          await offlineStorage.removePendingAction(action.id);
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error('Failed to sync action:', action, error);
        failed++;
      }
    }

    const remaining = pendingActions.length - successful - failed;

    return { successful, failed, remaining };
  }

  // Get sync status
  async getSyncStatus(): Promise<{
    pendingActions: number;
    isOnline: boolean;
    lastSync?: number;
  }> {
    const pendingActions = await offlineStorage.getPendingActions();
    
    return {
      pendingActions: pendingActions.length,
      isOnline: networkStatus.isOnline,
      lastSync: await offlineStorage.getUserPref('lastSync'),
    };
  }

  // Preload data for offline use
  async preloadData(urls: string[]): Promise<void> {
    if (!networkStatus.isOnline) {
      console.log('Cannot preload data while offline');
      return;
    }

    console.log('Preloading data for offline use...');
    
    for (const url of urls) {
      try {
        await this.get(url, { cacheFor: 24 * 60 * 60 * 1000 }); // Cache for 24 hours
      } catch (error) {
        console.warn('Failed to preload data for', url, error);
      }
    }
    
    console.log('Data preloading completed');
  }

  // Clear cached data
  async clearCache(pattern?: string): Promise<void> {
    if (pattern) {
      // Clear specific pattern (would need implementation in offlineStorage)
      console.log('Clearing cache for pattern:', pattern);
    } else {
      await offlineStorage.clearAllData();
    }
  }

  // Get storage statistics
  async getStorageStats() {
    return offlineStorage.getStorageStats();
  }
}

// Export singleton instance
export const offlineApi = new OfflineApi();

// React hook for offline status
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(networkStatus.isOnline);
  const [syncStatus, setSyncStatus] = useState({ pendingActions: 0 });

  useEffect(() => {
    const updateStatus = () => setIsOnline(networkStatus.isOnline);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    // Update sync status periodically
    const interval = setInterval(async () => {
      const status = await offlineApi.getSyncStatus();
      setSyncStatus(status);
    }, 5000);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearInterval(interval);
    };
  }, []);

  return {
    isOnline,
    syncStatus,
    syncNow: () => offlineApi.syncPendingActions(),
  };
}

import { useState, useEffect } from 'react';
