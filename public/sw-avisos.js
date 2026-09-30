/* VUNLEK · avisos: se carga dentro del service worker (workbox.importScripts). */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of list) {
      if ('focus' in c) {
        c.postMessage({ type: 'vunlek:navigate', url })
        return c.focus()
      }
    }
    return self.clients.openWindow(url)
  })())
})

/* Preparado para avisos con la app cerrada (Web Push): el servidor manda { title, body, url, tag }. */
self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch (e) { d = { body: event.data && event.data.text() } }
  event.waitUntil(self.registration.showNotification(d.title || 'VUNLEK', {
    body: d.body || 'Tienes un mensaje nuevo', tag: d.tag || 'vunlek', icon: '/pwa-192.png', badge: '/pwa-192.png', data: { url: d.url || '/messages' }, renotify: true,
  }))
})
