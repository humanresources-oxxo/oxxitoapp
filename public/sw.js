// public/sw.js
// Service worker of Conoxxo: ONLY shows the notification of a new aviso
// (src/services/avisosPush.ts, worker/push.js) and opens the app when it is
// tapped. It has no fetch handler on purpose: it never caches the app, so
// every deploy reaches phones exactly as before.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  // Always show something: browsers (Safari above all) penalize a push that
  // shows nothing. If the message can't be read, a generic one.
  let m = {};
  try {
    m = event.data ? event.data.json() : {};
  } catch (e) {
    m = {};
  }
  const titulo = typeof m.titulo === 'string' && m.titulo ? m.titulo : 'Nuevo aviso de RH';
  const opciones = {
    body: typeof m.texto === 'string' && m.texto ? m.texto : 'Ábrelo en Conoxxo.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: typeof m.etiqueta === 'string' ? m.etiqueta : 'aviso',
    data: { url: typeof m.url === 'string' && m.url.startsWith('/') ? m.url : '/?ir=avisos' },
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/?ir=avisos', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          if ('navigate' in c) c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
