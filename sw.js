/* ─────────────────────────────────────────────────────────────────────────
   bank36 — Service Worker  (sw.js)
   • Bump CACHE_VERSION every deploy to bust old caches automatically.
   • Vercel injects a unique build ID into each deploy, so this file
     itself will change on each push — the browser will detect the diff
     and trigger the update flow in index.html.
   ───────────────────────────────────────────────────────────────────────── */

// ── 1. VERSION — increment this string on every release ──────────────────
//    You can automate this with a build step (e.g. sed, vite-plugin, etc.)
//    but even manual bumping works perfectly.
const CACHE_VERSION = 'bank36-v6';

// ── 2. ASSETS TO PRE-CACHE (shell) ───────────────────────────────────────
//    Keep this list lean — only the files needed to render the first screen.
//    Everything else will be cached on first fetch (network-first strategy).
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

// ── 3. INSTALL — pre-cache shell assets ──────────────────────────────────
self.addEventListener('install', function (event) {
  console.log('[bank36-sw] Installing version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Don't call skipWaiting() here — let the app prompt the user first.
});

// ── 4. ACTIVATE — delete old caches ──────────────────────────────────────
self.addEventListener('activate', function (event) {
  console.log('[bank36-sw] Activating version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_VERSION; })
          .map(function (key) {
            console.log('[bank36-sw] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(function () {
      // Take control of all open clients immediately after activation
      return self.clients.claim();
    })
  );
});

// ── 5. FETCH — Network-first strategy ────────────────────────────────────
//    Try the network first so users always get fresh data.
//    Fall back to cache if offline.
self.addEventListener('fetch', function (event) {
  // Only handle GET requests for same-origin or CDN assets
  if (event.request.method !== 'GET') return;

  // Skip non-http(s) requests (chrome-extension://, etc.)
  var url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // Skip Firebase, EmailJS, and other API calls — always go to network
  var bypassHosts = [
    'firebaseio.com',
    'googleapis.com',
    'firebaseapp.com',
    'emailjs.com',
    'jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ];
  if (bypassHosts.some(function (h) { return url.hostname.includes(h); })) {
    return; // Let the browser handle it normally
  }

  event.respondWith(
    fetch(event.request)
      .then(function (networkResponse) {
        // Cache a clone of the fresh response
        if (networkResponse && networkResponse.status === 200) {
          var clone = networkResponse.clone();
          caches.open(CACHE_VERSION).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      })
      .catch(function () {
        // Network failed — serve from cache
        return caches.match(event.request).then(function (cached) {
          if (cached) return cached;
          // If navigating and nothing cached, return the app shell
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// ── 6. MESSAGE — receive SKIP_WAITING from the update banner ─────────────
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[bank36-sw] Received SKIP_WAITING — activating new version');
    self.skipWaiting();
  }
});
