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

/* Aviso enviado por el servidor (llega aunque VUNLEK esté cerrada): { title, body, url, tag }. */
self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch (e) { d = { body: event.data && event.data.text() } }
  event.waitUntil((async () => {
    // Si VUNLEK está abierta y a la vista, la propia página ya avisa (sonido y mensaje): no se duplica
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const front = list.filter((c) => c.visibilityState === 'visible' && c.focused)
    if (front.length) { front.forEach((c) => c.postMessage({ type: 'vunlek:push', title: d.title, body: d.body, url: d.url, tag: d.tag })); return }
    await self.registration.showNotification(d.title || 'VUNLEK', {
      body: d.body || 'Tienes un aviso nuevo', tag: d.tag || 'vunlek', icon: '/pwa-192.png', badge: '/pwa-192.png',
      data: { url: d.url || '/' }, renotify: true, vibrate: [120, 60, 120],
    })
  })())
})

/* El navegador renovó la suscripción: se avisa a la página para que la registre de nuevo. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    list.forEach((c) => c.postMessage({ type: 'vunlek:push-renew' }))
  })())
})
