export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered:', registration);

        // Initialize offline storage
        const { offlineStorage } = await import('./utils/offlineStorage');
        await offlineStorage.init();
        console.log('Offline storage initialized');

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                if (confirm('A new version of the app is available. Reload to update?')) {
                  window.location.reload();
                }
              }
            });
          }
        });

      } catch (error) {
        console.log('SW registration failed:', error);
      }
    });
  }
}
