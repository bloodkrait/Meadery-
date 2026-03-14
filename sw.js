/**
 * The Meadery — Service Worker
 * Version: 3.1
 *
 * Strategy: Network-first for all requests.
 * - Always tries the network first so users get the latest version when online.
 * - Falls back to the cache if the network fails (offline support).
 * - Falls back to offline.html if neither network nor cache can serve the request.
 *
 * Cache: Versioned. Bumping CACHE_NAME invalidates all old caches on next install.
 * To update the app: increment CACHE_NAME, redeploy. Old caches are deleted on activate.
 */

const CACHE_NAME = 'meadery-v3.1';

/**
 * App shell — all files pre-cached on install.
 * These are the minimum assets needed to run the app offline from first load.
 */
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/offline.html',
  '/icon-192.png',
  '/icon-384.png',
  '/icon-512.png',
  '/sw.js',
];

// ─── INSTALL ────────────────────────────────────────────────────────────────
// Pre-cache the app shell when the service worker is installed.
// skipWaiting() forces the new SW to activate immediately rather than waiting
// for all tabs using the old SW to close.
self.addEventListener('install', event => {
  console.log('[SW] Installing version:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching app shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => {
        console.log('[SW] App shell cached successfully');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Pre-cache failed:', err);
      })
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────────────────────
// Delete all caches that don't match the current CACHE_NAME.
// This runs after install, cleaning up stale caches from previous versions.
// clients.claim() makes the SW take control of all open tabs immediately
// without requiring a page reload.
self.addEventListener('activate', event => {
  console.log('[SW] Activating version:', CACHE_NAME);
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        const deletions = cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting stale cache:', name);
            return caches.delete(name);
          });
        return Promise.all(deletions);
      })
      .then(() => {
        console.log('[SW] Old caches cleared. Taking control of clients.');
        return self.clients.claim();
      })
  );
});

// ─── FETCH ──────────────────────────────────────────────────────────────────
// Network-first strategy:
//   1. Try the network. If successful, update the cache and return the response.
//   2. If the network fails, try the cache.
//   3. If nothing is cached, serve offline.html as the fallback.
//
// Opaque responses (cross-origin, e.g. Google Fonts) are passed through
// without caching to avoid storing invalid responses.
self.addEventListener('fetch', event => {
  // Only handle GET requests — skip POST, PUT, etc.
  if (event.request.method !== 'GET') return;

  // Skip non-HTTP(S) requests (chrome-extension:// etc.)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Network succeeded — cache the response if it's valid and same-origin
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type !== 'opaque'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              console.log('[SW] Serving from cache:', event.request.url);
              return cachedResponse;
            }
            // Nothing cached — serve offline fallback for navigation requests
            if (event.request.mode === 'navigate') {
              console.log('[SW] Serving offline fallback');
              return caches.match('/offline.html');
            }
            // For non-navigation requests with no cache, return nothing
            return new Response('', { status: 503, statusText: 'Service Unavailable' });
          });
      })
  );
});
