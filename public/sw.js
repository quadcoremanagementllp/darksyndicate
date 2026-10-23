// Dark Syndicate Gaming World - Progressive Web App (PWA) Service Worker
// Version: 1.3.0
// Features: Offline Caching, Cache-First Static Assets, Network-First Pages, Web Push & Mobile Vibration

const CACHE_NAME = 'ds-pwa-v1.3.0';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo-1024.png',
  '/icon-512.png',
  '/icon-192.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
];

// Offline HTML fallback for when mobile loses internet connection
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
  <title>Offline • DARK SYNDICATE</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #070a13;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      box-sizing: border-box;
      padding: 24px;
    }
    .card {
      max-width: 420px;
      width: 100%;
      background: #0f172a;
      border: 1px solid rgba(6, 182, 212, 0.3);
      border-radius: 24px;
      padding: 32px 24px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.8);
    }
    .logo {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      border-radius: 16px;
      box-shadow: 0 0 20px rgba(6, 182, 212, 0.4);
    }
    h1 {
      font-size: 20px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0 0 8px;
      color: #ffffff;
    }
    p {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.5;
      margin: 0 0 24px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      box-sizing: border-box;
      padding: 12px 20px;
      border-radius: 12px;
      background: #06b6d4;
      color: #000;
      font-weight: 800;
      font-size: 13px;
      text-transform: uppercase;
      text-decoration: none;
      letter-spacing: 0.5px;
      border: none;
      cursor: pointer;
    }
    .btn:active {
      transform: scale(0.98);
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="/icon-192.png" alt="Dark Syndicate Logo" class="logo" />
    <h1>You are Offline</h1>
    <p>Dark Syndicate requires an active internet connection to sync floor timers and reservations. Please reconnect to Wi-Fi or mobile data.</p>
    <button class="btn" onclick="window.location.reload()">Retry Connection</button>
  </div>
</body>
</html>`;

// 1. Install Event: Cache essential static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[PWA SW] Pre-caching static assets failed:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean up legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Strategy:
// - API calls & mutations: Network-only
// - Static assets (images, icons, fonts): Cache-first
// - Navigation (HTML pages): Network-first with offline fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Bypass non-GET requests and internal Next.js dev HMR
  if (req.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.includes('/_next/webpack-hmr')) {
    return;
  }

  // A. Static Image & Font Assets: Cache-First
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff|woff2)$/i) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        }).catch(() => caches.match('/icon-192.png'));
      })
    );
    return;
  }

  // B. HTML Navigation Requests: Network-First with Offline Fallback
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cachedPage = await caches.match(req);
          if (cachedPage) return cachedPage;
          return new Response(OFFLINE_HTML, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
  }
});

// 4. Notification Click Event: Focus or Open Staff Portal
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/staff';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/staff') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 5. Mobile Push Event: Display System Lock-Screen Banner with Vibration
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Dark Syndicate Alert',
    body: 'Gaming session update on the floor.',
    url: '/staff',
    tag: 'ds-staff-alert',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [250, 100, 250, 100, 250],
    tag: payload.tag || 'ds-staff-alert',
    renotify: true,
    requireInteraction: true,
    data: {
      url: payload.url || '/staff',
      timestamp: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});
