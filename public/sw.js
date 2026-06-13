/* PWA Service Worker：安装条件 + Web Push 系统通知 */

const NOTIFY_ICON_CACHE = 'lumi-notify-icons-v1'
const NOTIFY_ICON_PATH_MARKER = '/__lumi_notify_icon__/'

function resolveDefaultIconUrl() {
  try {
    return new URL('image/主屏幕图标.png', self.registration.scope).href
  } catch {
    return 'image/主屏幕图标.png'
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/** 通知头像：页面将 data URL 写入 Cache 后，由 SW 在同源路径下读出 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (!url.pathname.includes(NOTIFY_ICON_PATH_MARKER)) return
  event.respondWith(
    caches.open(NOTIFY_ICON_CACHE).then((cache) =>
      cache.match(event.request).then((cached) => cached || new Response('', { status: 404, statusText: 'Not Found' })),
    ),
  )
})

/** 页面在后台时由主线程转发（备用路径；优先由页面直接 reg.showNotification） */
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || typeof data !== 'object') return
  if (data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
    return
  }
  if (data.type === 'lumi-keepalive-ping') return
  if (data.type === 'lumi-keepalive-show') {
    const title = typeof data.title === 'string' ? data.title : 'Lumi Phone'
    const body = typeof data.body === 'string' ? data.body : '后台运行中 · 等待微信新消息'
    const icon = typeof data.icon === 'string' ? data.icon : resolveDefaultIconUrl()
    void self.registration
      .showNotification(title, {
        body,
        icon,
        badge: icon,
        tag: 'lumi-keepalive-session',
        silent: true,
        data: { type: 'keepalive-session' },
      })
      .catch(() => {})
    return
  }
  if (data.type === 'lumi-keepalive-hide') {
    event.waitUntil(
      self.registration.getNotifications({ tag: 'lumi-keepalive-session' }).then((list) => {
        list.forEach((n) => n.close())
      }),
    )
    return
  }
  if (data.type !== 'lumi-show-notification') return
  const title = typeof data.title === 'string' ? data.title : 'Lumi Phone'
  const body = typeof data.body === 'string' ? data.body : '新消息'
  const tag = typeof data.tag === 'string' ? data.tag : 'lumi-local'
  const icon = typeof data.icon === 'string' && data.icon.trim() ? data.icon.trim() : resolveDefaultIconUrl()
  const badge = resolveDefaultIconUrl()
  void self.registration
    .showNotification(title, {
      body,
      icon,
      badge,
      image: icon,
      data: data.data && typeof data.data === 'object' ? data.data : {},
      tag,
      renotify: true,
      vibrate: [200, 100, 200],
    })
    .catch(() => {})
})

self.addEventListener('push', (event) => {
  let payload = { title: 'Lumi Phone', body: '新消息', data: {} }
  try {
    if (event.data) {
      const parsed = event.data.json()
      payload = {
        title: typeof parsed.title === 'string' ? parsed.title : payload.title,
        body: typeof parsed.body === 'string' ? parsed.body : payload.body,
        data: parsed.data && typeof parsed.data === 'object' ? parsed.data : {},
      }
    }
  } catch {
    /* 使用默认文案 */
  }

  const icon = resolveDefaultIconUrl()
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon,
      badge: icon,
      data: payload.data,
      tag: 'lumi-push',
      renotify: true,
      vibrate: [200, 100, 200],
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(self.registration.scope)
      }
      return undefined
    }),
  )
})
