// Service worker for the map viewer PWA.
// Strategy: network-first for the app shell (so edits show up on refresh),
// cache-first for the MapLibre CDN files and icons. Map tiles are never
// cached here — they'd fill the cache quickly and have their own HTTP caching.

const CACHE = 'mapviewer-v1';
const SHELL = [
    '.',
    'index.html',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/apple-touch-icon.png',
    'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css',
    'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js',
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET') return;

    // App shell (same-origin pages/files): network-first, fall back to cache.
    if (url.origin === location.origin) {
        e.respondWith(
            fetch(e.request)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(e.request, copy));
                    return res;
                })
                .catch(() => caches.match(e.request, {ignoreSearch: true}))
        );
        return;
    }

    // MapLibre CDN files: cache-first (versioned URLs, safe to keep).
    if (url.hostname === 'unpkg.com') {
        e.respondWith(
            caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(e.request, copy));
                return res;
            }))
        );
    }
    // Everything else (tiles, terrain, fonts) goes straight to the network.
});
