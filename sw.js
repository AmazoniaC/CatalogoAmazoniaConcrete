// Bump CACHE_VERSION on every deploy to invalidate old caches.
const CACHE_VERSION = 'v2';
const CACHE_NAME = 'amazonia-' + CACHE_VERSION;
const ASSETS = [
  './',
  './index.html',
  './data.json',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: always try the network so updated HTML/JSON reach visitors,
// falling back to cache only when offline.
function networkFirst(request) {
  return fetch(request).then(response => {
    if (response && response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, clone));
    }
    return response;
  }).catch(() => caches.match(request).then(r => r || caches.match('./index.html')));
}

// Cache-first: fast static assets, refreshed in the background.
function cacheFirst(request) {
  return caches.match(request).then(cached => {
    const network = fetch(request).then(response => {
      if (response && response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, clone));
      }
      return response;
    }).catch(() => cached);
    return cached || network;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // HTML pages (navigations + .html) and data.json must always be fresh.
  const isNavigation = req.mode === 'navigate';
  const isHTML = req.destination === 'document' || /\.html($|\?)/.test(req.url);
  const isData = req.url.includes('data.json');

  if (isNavigation || isHTML || isData) {
    e.respondWith(networkFirst(req));
    return;
  }

  e.respondWith(cacheFirst(req));
});
