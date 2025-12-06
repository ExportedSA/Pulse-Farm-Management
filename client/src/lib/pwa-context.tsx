import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

interface PWAContextType {
  isOnline: boolean;
  isUpdateAvailable: boolean;
  canInstall: boolean;
  offlineQueueCount: number;
  installApp: () => void;
  updateServiceWorker: () => void;
  clearCache: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within PWAProvider');
  }
  return context;
}

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      toast({
        title: 'Back online',
        description: 'Syncing offline changes...',
      });
      
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
          registration.active.postMessage({ type: 'SYNC_QUEUE' });
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'You are offline',
        description: 'Changes will be saved and synced when you reconnect.',
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(async (registration) => {
        if (navigator.onLine && registration.active) {
          registration.active.postMessage({ type: 'SYNC_QUEUE' });
        }
      });
      
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_COMPLETE') {
          const { successCount, totalCount } = event.data;
          if (successCount > 0) {
            toast({
              title: 'Sync complete',
              description: `${successCount} of ${totalCount} offline changes synced successfully.`,
            });
          }
          setOfflineQueueCount(0);
        }
        
        if (event.data && event.data.type === 'QUEUE_UPDATED') {
          const { queueLength } = event.data;
          setOfflineQueueCount(queueLength);
        }
      });

      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setIsUpdateAvailable(true);
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setIsUpdateAvailable(true);
                toast({
                  title: 'Update available',
                  description: 'A new version of Pulse is ready. Click to update.',
                  action: (
                    <button
                      onClick={updateServiceWorker}
                      className="text-sm font-medium"
                      data-testid="button-update-sw"
                    >
                      Update
                    </button>
                  ),
                });
              }
            });
          }
        });
      });
    }
  }, [toast]);

  const installApp = () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
      if (choiceResult.outcome === 'accepted') {
        toast({
          title: 'App installed',
          description: 'Pulse has been added to your home screen.',
        });
      }
      setDeferredPrompt(null);
      setCanInstall(false);
    });
  };

  const updateServiceWorker = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      setIsUpdateAvailable(false);
    }
  };

  const clearCache = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage({ type: 'CLEAR_CACHE' });
        toast({
          title: 'Cache cleared',
          description: 'All cached data has been removed.',
        });
      }
    }
  };

  return (
    <PWAContext.Provider
      value={{
        isOnline,
        isUpdateAvailable,
        canInstall,
        offlineQueueCount,
        installApp,
        updateServiceWorker,
        clearCache,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}
