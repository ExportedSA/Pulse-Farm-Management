/**
 * Offline Status and Sync Hook for Pulse PWA
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineStorage, STORES } from '@/lib/offline-storage';
import { toast } from 'sonner';

interface OfflineStatus {
  isOnline: boolean;
  pendingActions: number;
  lastSync: Date | null;
  isSyncing: boolean;
}

export function useOffline() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingActions: 0,
    lastSync: null,
    isSyncing: false,
  });

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      toast.success('Back online!', { description: 'Syncing pending changes...' });
      syncPendingActions();
    };

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
      toast.warning('You are offline', { description: 'Changes will be saved locally' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending actions count
  useEffect(() => {
    const loadPendingCount = async () => {
      try {
        const actions = await offlineStorage.getPendingActions();
        const lastSyncStr = localStorage.getItem('lastSync');
        setStatus(prev => ({
          ...prev,
          pendingActions: actions.length,
          lastSync: lastSyncStr ? new Date(lastSyncStr) : null,
        }));
      } catch (error) {
        console.error('Failed to load pending actions:', error);
      }
    };

    loadPendingCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sync pending actions
  const syncPendingActions = useCallback(async () => {
    if (!status.isOnline || status.isSyncing) return;

    setStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      const result = await offlineStorage.syncPendingActions();
      
      if (result.success > 0) {
        toast.success(`Synced ${result.success} changes`);
      }
      
      if (result.failed > 0) {
        toast.error(`Failed to sync ${result.failed} changes`, {
          description: 'Will retry automatically',
        });
      }

      // Refresh pending count
      const actions = await offlineStorage.getPendingActions();
      setStatus(prev => ({
        ...prev,
        pendingActions: actions.length,
        lastSync: new Date(),
        isSyncing: false,
      }));
    } catch (error) {
      console.error('Sync failed:', error);
      setStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, [status.isOnline, status.isSyncing]);

  // Queue an action for offline sync
  const queueAction = useCallback(async (
    endpoint: string,
    method: 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    body: any
  ): Promise<string> => {
    const actionId = await offlineStorage.addPendingAction({
      endpoint,
      method,
      body,
    });

    setStatus(prev => ({ ...prev, pendingActions: prev.pendingActions + 1 }));

    // If online, try to sync immediately
    if (status.isOnline) {
      syncPendingActions();
    }

    return actionId;
  }, [status.isOnline, syncPendingActions]);

  // Make an API request with offline support
  const fetchWithOffline = useCallback(async <T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<{ data: T | null; fromCache: boolean; error?: string }> => {
    const method = options?.method || 'GET';

    // For GET requests, try network first, then cache
    if (method === 'GET') {
      if (status.isOnline) {
        try {
          const response = await fetch(endpoint, options);
          if (response.ok) {
            const data = await response.json();
            return { data, fromCache: false };
          }
        } catch (error) {
          console.log('Network request failed, trying cache');
        }
      }

      // Try to get from cache
      // This would need to be customized based on the endpoint
      return { data: null, fromCache: true, error: 'Offline - using cached data' };
    }

    // For write operations, queue if offline
    if (!status.isOnline && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const body = options?.body ? JSON.parse(options.body as string) : {};
      await queueAction(endpoint, method as any, body);
      return { data: null, fromCache: false, error: 'Queued for sync' };
    }

    // Online write operation
    try {
      const response = await fetch(endpoint, options);
      if (response.ok) {
        const data = await response.json();
        return { data, fromCache: false };
      }
      return { data: null, fromCache: false, error: `HTTP ${response.status}` };
    } catch (error) {
      // Queue for later if network fails
      if (options?.body) {
        const body = JSON.parse(options.body as string);
        await queueAction(endpoint, method as any, body);
        return { data: null, fromCache: false, error: 'Queued for sync' };
      }
      return { data: null, fromCache: false, error: 'Network error' };
    }
  }, [status.isOnline, queueAction]);

  return {
    ...status,
    syncPendingActions,
    queueAction,
    fetchWithOffline,
  };
}

/**
 * Hook for caching and retrieving animals offline
 */
export function useOfflineAnimals() {
  const [animals, setAnimals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const { isOnline } = useOffline();

  useEffect(() => {
    const loadAnimals = async () => {
      setIsLoading(true);
      
      try {
        if (isOnline) {
          // Try to fetch from API
          const response = await fetch('/api/animals');
          if (response.ok) {
            const data = await response.json();
            setAnimals(data);
            // Cache for offline use
            await offlineStorage.cacheAnimals(data);
            setCacheAge(0);
          }
        } else {
          // Load from cache
          const cached = await offlineStorage.getCachedAnimals();
          setAnimals(cached);
          const age = await offlineStorage.getCacheAge(STORES.ANIMALS);
          setCacheAge(age);
        }
      } catch (error) {
        console.error('Failed to load animals:', error);
        // Fallback to cache
        const cached = await offlineStorage.getCachedAnimals();
        setAnimals(cached);
        const age = await offlineStorage.getCacheAge(STORES.ANIMALS);
        setCacheAge(age);
      }
      
      setIsLoading(false);
    };

    loadAnimals();
  }, [isOnline]);

  const refreshAnimals = useCallback(async () => {
    if (!isOnline) {
      toast.error('Cannot refresh while offline');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/animals');
      if (response.ok) {
        const data = await response.json();
        setAnimals(data);
        await offlineStorage.cacheAnimals(data);
        setCacheAge(0);
        toast.success('Animals refreshed');
      }
    } catch (error) {
      toast.error('Failed to refresh animals');
    }
    setIsLoading(false);
  }, [isOnline]);

  return {
    animals,
    isLoading,
    cacheAge,
    refreshAnimals,
    isFromCache: cacheAge !== null && cacheAge > 0,
  };
}

/**
 * Hook for offline treatment recording
 */
export function useOfflineTreatment() {
  const { isOnline, queueAction } = useOffline();

  const recordTreatment = useCallback(async (treatment: any): Promise<{ success: boolean; queued: boolean }> => {
    if (isOnline) {
      try {
        const response = await fetch('/api/treatments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(treatment),
        });

        if (response.ok) {
          toast.success('Treatment recorded');
          return { success: true, queued: false };
        }
      } catch (error) {
        console.log('Network failed, queuing treatment');
      }
    }

    // Queue for offline sync
    await queueAction('/api/treatments', 'POST', treatment);
    
    // Also save to local cache
    await offlineStorage.put(STORES.TREATMENTS, {
      ...treatment,
      id: `offline-${Date.now()}`,
      pendingSync: true,
    });

    toast.info('Treatment saved offline', { description: 'Will sync when online' });
    return { success: true, queued: true };
  }, [isOnline, queueAction]);

  return { recordTreatment };
}
