const CACHE_NAME = 'happy-house-bills-v1';
const OFFLINE_URL = '/offline.html';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/', // Main app
        '/index.html', // Fallback
        '/manifest.webmanifest',
        '/assets/css/tokens.css',
      ]);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName.startsWith('happy-house-bills-');
          })
          .map((cacheName) => {
            return caches.delete(cacheName);
          })
      );
    })
  );
  
  // Take control of all clients
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    handleApiRequest(event, request);
    return;
  }
  
  // Handle asset requests
  if (url.pathname.startsWith('/assets/') || url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|ico)$/)) {
    handleAssetRequest(event, request);
    return;
  }
  
  // Handle HTML requests
  if (request.headers.get('accept')?.includes('text/html')) {
    handleHtmlRequest(event, request);
    return;
  }
  
  // Default: stale-while-revalidate
  handleDefaultRequest(event, request);
});

function handleApiRequest(event: FetchEvent, request: Request) {
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => {
          return cache.match(request) || new Response(
            JSON.stringify({ error: 'Offline' }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' },
            }
          );
        });
    })
  );
}

function handleAssetRequest(event: FetchEvent, request: Request) {
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(request).then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        });
      });
    })
  );
}

function handleHtmlRequest(event: FetchEvent, request: Request) {
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      
      return fetch(request).then((response) => {
        if (response.ok) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
            return response;
          });
        }
        
        return caches.match(OFFLINE_URL);
      });
    })
  );
}

function handleDefaultRequest(event: FetchEvent, request: Request) {
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(request).then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        });
      });
    })
  );
}

// Background sync for queued actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'happy-house-bills-sync') {
    event.waitUntil(syncAllActions());
  }
});

async function syncAllActions() {
  try {
    const queuedActions = await getQueuedActions();
    
    for (const action of queuedActions) {
      try {
        await performAction(action);
        await removeQueuedAction(action.id);
      } catch (error) {
        console.error(`Failed to sync action ${action.id}:`, error);
        break;
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}

async function getQueuedActions() {
  const records = await indexedDB
    .open('happy-house-bills')
    .transaction('queued_actions', 'readonly')
    .objectStore('queued_actions')
    .getAll();
  
  return records || [];
}

async function removeQueuedAction(actionId: string) {
  await indexedDB
    .open('happy-house-bills')
    .transaction('queued_actions', 'readwrite')
    .objectStore('queued_actions')
    .delete(actionId);
}

async function performAction(action: any) {
  const response = await fetch(action.endpoint, {
    method: action.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(action.data),
  });
  
  if (!response.ok) {
    throw new Error(`Action failed: ${response.statusText}`);
  }
  
  return response.json();
}
