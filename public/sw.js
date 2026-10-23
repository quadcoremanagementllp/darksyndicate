// Dark Syndicate Gaming World - Mobile & Desktop Push Notification Service Worker
// Supports Android (Chrome/Samsung/Firefox), Apple iOS 16.4+ (iPhone & iPad PWA/Safari), and Desktop

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification tap / click
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

// Handle incoming Web Push event
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
    icon: '/logo-1024.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200, 100, 200],
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
