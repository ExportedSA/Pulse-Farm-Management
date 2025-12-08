const CACHE_NAME = 'pulse-farm-v2.0.0';
const STATIC_CACHE = 'pulse-static-v2.0.0';
const DATA_CACHE = 'pulse-data-v2.0.0';
const OFFLINE_QUEUE = 'pulse-offline-queue';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/offline.html',
];

// API endpoints that can be cached for offline reading
const CACHEABLE_PATTERNS = [
  /^\/api\/animals/,
  /^\/api\/pastures/,
  /^\/api\/treatments/,
  /^\/api\/milk\/records/,
  /^\/api\/financial/,
  /^\/api\/weather/,
  /^\/api\/integrations\/weather/,
  /^\/api\/integrations\/nait/,
  /^\/api\/integrations\/lic/,
  /^\/api\/integrations\/fonterra/,
  /^\/api\/benchmarking/,
  /^\/api\/nzfap/,
  /^\/api\/groups/,
];

// API endpoints that support offline queuing for writes
const QUEUEABLE_ENDPOINTS = [
  '/api/animals',
  '/api/treatments',
  '/api/pastures/movements',
  '/api/reproduction',
  '/api/milk/records',
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DATA_CACHE) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle static files
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          return response || fetch(request);
        })
    );
    return;
  }
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
});

// Handle API requests with offline support
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful GET requests
    if (networkResponse.ok && isCacheableRequest(url.pathname)) {
      const cache = await caches.open(DATA_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache', request.url);
    
    // Try cache for GET requests
    if (request.method === 'GET' && isCacheableRequest(url.pathname)) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Return offline response for specific endpoints
    return getOfflineResponse(request);
  }
}

// Check if request should be cached
function isCacheableRequest(pathname) {
  return CACHEABLE_PATTERNS.some(pattern => pattern.test(pathname));
}

// Generate offline responses for different endpoints
async function getOfflineResponse(request) {
  const url = new URL(request.url);
  
  // Milk records offline response
  if (url.pathname === '/api/milk/records') {
    const cachedData = await getOfflineData('milkRecords');
    return new Response(JSON.stringify(cachedData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Financial expenses offline response
  if (url.pathname === '/api/financial/expenses') {
    const cachedData = await getOfflineData('financialExpenses');
    return new Response(JSON.stringify(cachedData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Weather offline response
  if (url.pathname.startsWith('/api/weather/current/')) {
    const location = url.pathname.split('/').pop();
    const cachedWeather = await getOfflineData(`weather_${location}`);
    if (cachedWeather) {
      return new Response(JSON.stringify(cachedWeather), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // NZFAP standards offline response
  if (url.pathname === '/api/nzfap/standards') {
    const cachedData = await getOfflineData('nzfapStandards');
    return new Response(JSON.stringify(cachedData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Default offline response
  return new Response(JSON.stringify({
    error: 'Offline - No cached data available',
    offline: true,
    message: 'This content is not available offline'
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Get offline data from IndexedDB
async function getOfflineData(key) {
  try {
    // This would integrate with IndexedDB for offline storage
    // For now, return empty data
    return [];
  } catch (error) {
    console.error('Error getting offline data:', error);
    return null;
  }
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_DATA') {
    cacheDataForOffline(event.data.key, event.data.data);
  }
});

// Cache data for offline use
async function cacheDataForOffline(key, data) {
  try {
    // This would store data in IndexedDB for offline use
    console.log('Service Worker: Caching data for offline use', key);
  } catch (error) {
    console.error('Error caching offline data:', error);
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Perform background sync when online
async function doBackgroundSync() {
  try {
    // Get pending actions from IndexedDB
    const pendingActions = await getPendingActions();
    
    for (const action of pendingActions) {
      try {
        await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        });
        
        // Remove successful action from pending
        await removePendingAction(action.id);
      } catch (error) {
        console.error('Failed to sync action:', action, error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Get pending actions from IndexedDB
async function getPendingActions() {
  // This would retrieve pending actions from IndexedDB
  return [];
}

// Remove pending action from IndexedDB
async function removePendingAction(id) {
  // This would remove the action from IndexedDB
  console.log('Removing pending action:', id);
}
