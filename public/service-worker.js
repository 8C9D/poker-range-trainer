/* Offline app-shell caching for the Poker Range Trainer PWA (v3.1).
 *
 * Hand-written (no build plugin). Strategy:
 *  - Pre-cache the known static shell on install.
 *  - Runtime cache-on-fetch for same-origin GET requests (covers Vite's hashed
 *    asset URLs, which can't be listed ahead of time): network-first, falling
 *    back to cache when offline; successful responses are cached for next time.
 *  - Never touch cross-origin requests (e.g. Supabase API calls) — let them go
 *    straight to the network.
 */

const CACHE_NAME = 'prt-shell-v1'
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/app-icon.svg',
  '/favicon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // Only handle same-origin GETs; everything else (incl. Supabase) goes to network.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return
  }
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache a copy of successful basic responses for offline use.
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() =>
        caches.match(request).then((cached) => cached ?? caches.match('/index.html')),
      ),
  )
})
