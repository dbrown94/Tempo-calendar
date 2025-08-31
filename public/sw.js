self.addEventListener('push', (event) => {
   let data = {};
   try { data = event.data ? event.data.json() : {}; } catch {}
   const title = data.title || 'Tempo Calendar';
   const body = data.body   || '';
   const options = {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/baddge.png',
        data, 
   }
   event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(clients.openWindow(url));
});

/* Minimal Tempo SW: receives pushes and shows a notification */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}

  const title = data.title || 'Tempo Calendar';
  const body  = data.body  || '';
  const options = {
    body,
    icon: '/icons/icon-192.png',    // adjust to your actual paths
    badge: '/icons/badge.png',      // optional
    data,                           // passed to notificationclick
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // open the app (or a deep link if you include one in data.url)
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.openWindow(url));
});
