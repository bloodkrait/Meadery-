// ── The Meadery — Service Worker ─────────────────────────────────────────────
// Caches all core assets on install for full offline support.

const CACHE_NAME = 'meadery-v3.4';

const ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/icon-192.png',
  '/icon-384.png',
  '/icon-512.png',
  '/manifest.webmanifest',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:ital,wght@0,300;0,400;1,300&display=swap'
];

// ── Install: cache all core assets ───────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fall back to network ────────────────────────────
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        // If offline and no cache match, serve offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
      });
    })
  );
});
