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

        // A new version is announced in the app with a Reload button (see watchForUpdates in
        // lib/pwa-context.tsx), not with a browser pop-up, which froze the whole page until answered.
      } catch (error) {
        console.log('SW registration failed:', error);
      }
    });
  }
}
