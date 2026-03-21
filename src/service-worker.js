const CACHE_NAME = 'chatwallet-cache-v3b';
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
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
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
    })
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
    clients.openWindow('/')
  );
});
