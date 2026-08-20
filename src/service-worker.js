const CACHE_NAME = 'chatwallet-cache-2.14';
const urlsToCache = [
  '/',
  '/dapp.html',
  '/index.html',
  '/js/ethers-6.13.2.umd.min.js',
  '/js/Tone.min.js',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
  '/static/anonym.jpg',
  '/static/chainsv1.json',
  // You might need to add more assets here as your app grows
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'})));
      })
      // El SW nuevo se activa al toque, sin esperar a que se cierren las pestañas
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // El HTML (navegaciones) va network-first: siempre fresco, con fallback a cache offline.
  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return response;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('/dapp.html')))
    );
    return;
  }

  // Assets (con hash de Parcel → inmutables): cache-first.
  event.respondWith(
    caches.match(req).then(response => response || fetch(req))
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // toma control de las pestañas abiertas ya mismo
  );
});

// Basic push notification listener
self.addEventListener('push', event => {
  const data = event.data.json();
  const title = data.title || 'ChatWallet';
  const options = {
    body: data.body || 'Tienes un nuevo mensaje.',
    icon: 'web-app-manifest-192x192.png',
    badge: 'favicon.ico'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Listener for notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/dapp.html')
  );
});
