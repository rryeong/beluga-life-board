self.addEventListener('push', (event) => {
  let data = {
    title: '벨루가네',
    body: '새로운 알림이 있어요.',
    url: '/beluga-life-board/',
  }

  if (event.data) {
    try {
      data = {
        ...data,
        ...event.data.json(),
      }
    } catch {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: '/beluga-life-board/icon-192.png',
    badge: '/beluga-life-board/icon-192.png',
    data: {
      url: data.url,
    },
  }

  event.waitUntil(
    self.registration.showNotification(
      data.title,
      options,
    ),
  )
})

self.addEventListener(
  'notificationclick',
  (event) => {
    event.notification.close()

    const targetUrl =
      event.notification.data?.url ||
      '/beluga-life-board/'

    event.waitUntil(
      self.clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        .then((clientList) => {
          for (const client of clientList) {
            if ('focus' in client) {
              client.navigate(targetUrl)

              return client.focus()
            }
          }

          if (self.clients.openWindow) {
            return self.clients.openWindow(
              targetUrl,
            )
          }
        }),
    )
  },
)
