/* ═══════════════════════════════════════════════════════════════
   FOODIE EXPRESS — Service Worker v1.0
   ═══════════════════════════════════════════════════════════════ */

const CACHE = 'foodie-express-v1';
const STATIC = [
  '/',
  '/index.html',
  '/restaurants.html',
  '/css/main.css',
  '/js/app.js',
  '/manifest.json',
  '/pages/restaurant.html',
  '/pages/checkout.html',
  '/pages/track.html',
  '/pages/dashboard.html',
  '/pages/offers.html',
];

/* Install — cache static assets */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(STATIC).catch(function(err) {
        console.warn('SW: some assets failed to cache', err);
      });
    })
  );
  self.skipWaiting();
});

/* Activate — clean old caches */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

/* Fetch — cache first for static, network first for API */
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  /* Skip non-GET */
  if (e.request.method !== 'GET') return;

  /* API requests — network first, no cache */
  if (url.includes('/api/') || url.includes('razorpay') || url.includes('nominatim')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(JSON.stringify({ success: false, message: 'You appear to be offline.' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  /* External CDN — network first with cache fallback */
  if (url.includes('unpkg.com') || url.includes('cdnjs') || url.includes('fonts.google')) {
    e.respondWith(
      fetch(e.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
        return response;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  /* Static assets — cache first */
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        var clone = response.clone();
        caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
        return response;
      }).catch(function() {
        /* Fallback for navigation requests */
        if (e.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

/* Push Notifications */
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {}
  var opts = {
    body:    data.body    || 'Your order is on the way! 🛵',
    icon:    '/assets/icon-192.png',
    badge:   '/assets/icon-72.png',
    vibrate: [100, 50, 100],
    data:    { url: data.url || '/pages/track.html' },
    actions: [
      { action: 'track',   title: '📍 Track Order' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  e.waitUntil(
    self.registration.showNotification(data.title || 'Foodie Express 🍔', opts)
  );
});

/* Notification click */
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var targetUrl = e.notification.data && e.notification.data.url ? e.notification.data.url : '/pages/track.html';
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(cls) {
      if (cls.length > 0) { cls[0].focus(); cls[0].navigate(targetUrl); }
      else { clients.openWindow(targetUrl); }
    })
  );
});
