// Push notification handler — appended to the generated Workbox SW by next-pwa

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'IcognitoChat', body: event.data.text() }
  }

  const title = payload.title ?? 'IcognitoChat'
  const options = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/' },
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const appVisible = clientList.some((c) => c.visibilityState === 'visible')
      if (appVisible) return // app em foco — não exibir
      return self.registration.showNotification(title, options)
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find((c) => c.url === url && 'focus' in c)
        if (existing) return existing.focus()
        return clients.openWindow(url)
      })
  )
})
