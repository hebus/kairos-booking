// Service worker : affiche les notifications push de l'admin et ouvre l'appli au clic.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* message vide ou invalide */ }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kairos', {
      body: data.body || '',
      icon: './icon.svg',
      tag: data.tag || undefined,
      data: { url: data.url || './#/admin/rendez-vous' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './#/admin/rendez-vous', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.registration.scope) && 'focus' in w) {
          w.navigate(target);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
