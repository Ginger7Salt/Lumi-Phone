import { publicAssetUrl } from '../../../publicAssetUrl'

/** Service Worker / dev server 从同源路径提供通知头像（data URL 与 /assets 需先发布） */
export const NOTIFY_ICON_CACHE_NAME = 'lumi-notify-icons-v1'
export const NOTIFY_ICON_PATH_MARKER = '/__lumi_notify_icon__/'

function hashString(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

function resolveAppBasePrefix(): string {
  const base = import.meta.env.BASE_URL || '/'
  if (base === '/') return '/'
  return base.endsWith('/') ? base : `${base}/`
}

/** 通知 icon 必须是同源绝对 URL；iOS / SW 无法直接使用 data: / blob: / 相对路径 */
export function absolutizeNotificationIconUrl(url: string): string {
  const raw = url.trim()
  if (!raw) return ''
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  if (typeof window === 'undefined') return raw
  try {
    const base = import.meta.env.BASE_URL || '/'
    // 规范路径如 /image/… 在 GitHub Pages 子目录部署时需加 /Lumi-Phone/ 前缀
    if (raw.startsWith('/') && base !== '/' && !raw.startsWith(base)) {
      return new URL(publicAssetUrl(raw), window.location.origin).href
    }
    const basePrefix = base === '/' ? '/' : base.endsWith('/') ? base : `${base}/`
    const path = raw.startsWith('/') ? raw : `${basePrefix}${raw}`.replace(/([^:]\/)\/+/g, '$1')
    return new URL(path, window.location.origin).href
  } catch {
    return raw
  }
}

export function buildCachedNotifyIconRequestUrl(contentKey: string): string {
  const prefix = resolveAppBasePrefix()
  const path = `${prefix}${NOTIFY_ICON_PATH_MARKER}${contentKey}`.replace(/([^:]\/)\/+/g, '$1')
  if (typeof window !== 'undefined') {
    return new URL(path, window.location.origin).href
  }
  return path
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const comma = dataUrl.indexOf(',')
    if (comma < 0) return null
    const header = dataUrl.slice(0, comma)
    const base64 = dataUrl.slice(comma + 1)
    const mime = header.match(/data:([^;]+)/i)?.[1]?.trim() || 'image/png'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}

async function readSourceImageBlob(source: string): Promise<Blob | null> {
  const raw = source.trim()
  if (!raw) return null

  if (raw.startsWith('data:')) {
    return dataUrlToBlob(raw)
  }

  try {
    const target = raw.startsWith('blob:') || /^https?:\/\//i.test(raw) ? raw : absolutizeNotificationIconUrl(raw)
    if (!target) return null
    const res = await fetch(target)
    if (!res.ok) return null
    const blob = await res.blob()
    const mime = blob.type || ''
    if (!mime.startsWith('image/')) return null
    return blob
  } catch {
    return null
  }
}

async function isPublishedNotifyIconReady(requestUrl: string): Promise<boolean> {
  if ('caches' in window) {
    try {
      const cache = await caches.open(NOTIFY_ICON_CACHE_NAME)
      if (await cache.match(requestUrl)) return true
    } catch {
      /* ignore */
    }
  }
  if (!import.meta.env.DEV) return false
  try {
    const res = await fetch(requestUrl, { method: 'HEAD', cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

async function publishNotificationIconBlob(contentKey: string, blob: Blob): Promise<string | null> {
  const requestUrl = buildCachedNotifyIconRequestUrl(contentKey)
  const mime = blob.type || 'image/png'

  if ('caches' in window) {
    try {
      const cache = await caches.open(NOTIFY_ICON_CACHE_NAME)
      await cache.put(
        requestUrl,
        new Response(blob.slice(), {
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'max-age=31536000, immutable',
          },
        }),
      )
    } catch {
      /* ignore */
    }
  }

  if (import.meta.env.DEV) {
    try {
      const putRes = await fetch(requestUrl, {
        method: 'POST',
        body: blob,
        headers: { 'Content-Type': mime },
      })
      if (!putRes.ok) return null
    } catch {
      return null
    }
  }

  return requestUrl
}

/**
 * 解析可在 OS 通知栏加载的头像 URL。
 * 本地上传 data URL 会镜像到 `/__lumi_notify_icon__/{hash}`，供 iOS 通知栏同源拉取。
 */
export async function resolveOsNotificationIconUrl(raw?: string, fallback?: string): Promise<string> {
  const fallbackUrl = fallback?.trim() || ''
  const input = raw?.trim()
  if (!input) return fallbackUrl
  if (input.startsWith('blob:')) return fallbackUrl

  const contentKey = hashString(input)
  const publishedUrl = buildCachedNotifyIconRequestUrl(contentKey)
  if (await isPublishedNotifyIconReady(publishedUrl)) return publishedUrl

  const blob = await readSourceImageBlob(input)
  if (!blob) {
    return absolutizeNotificationIconUrl(input) || fallbackUrl
  }

  const published = await publishNotificationIconBlob(contentKey, blob)
  if (published && (await isPublishedNotifyIconReady(published))) return published

  return absolutizeNotificationIconUrl(input) || fallbackUrl
}

/** 角色/群头像变更后可预热，避免首条通知才发布图标 */
export function prefetchNotifyIconFromAvatarUrl(raw?: string | null): void {
  const input = raw?.trim()
  if (!input || input.startsWith('blob:')) return
  void resolveOsNotificationIconUrl(input)
}
