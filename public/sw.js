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