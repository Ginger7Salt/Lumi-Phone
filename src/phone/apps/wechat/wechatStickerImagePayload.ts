import type { WeChatImageMime } from './newFriendsPersona/types'

function parseDataUrlParts(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!m) return null
  return { mime: String(m[1] ?? '').toLowerCase(), base64: String(m[2] ?? '').trim() }
}

function isSupportedStickerMime(mime: string): mime is WeChatImageMime {
  return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/gif' || mime === 'image/webp'
}

function guessStickerMimeFromUrl(url: string): WeChatImageMime | null {
  const path = url.split('?')[0]?.split('#')[0]?.toLowerCase() ?? ''
  if (path.endsWith('.gif')) return 'image/gif'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  return null
}

function sniffStickerMimeFromBytes(buf: ArrayBuffer): WeChatImageMime | null {
  const u8 = new Uint8Array(buf.slice(0, 12))
  if (u8.length < 3) return null
  const head6 = String.fromCharCode(...u8.slice(0, 6))
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif'
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return 'image/png'
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'image/jpeg'
  if (u8.length >= 12 && head6.startsWith('RIFF') && String.fromCharCode(...u8.slice(8, 12)) === 'WEBP') {
    return 'image/webp'
  }
  return null
}

function sniffStickerMimeFromBase64(base64: string): WeChatImageMime | null {
  try {
    const sample = atob(base64.slice(0, 24))
    const bytes = new Uint8Array(sample.length)
    for (let i = 0; i < sample.length; i += 1) bytes[i] = sample.charCodeAt(i)
    return sniffStickerMimeFromBytes(bytes.buffer)
  } catch {
    return null
  }
}

function normalizeHttpContentType(raw: string): string {
  const head = raw.split(';')[0]?.trim().toLowerCase() ?? ''
  return head
}

function resolveStickerMime(rawMime: string, url: string, buf: ArrayBuffer): WeChatImageMime | null {
  const mime = normalizeHttpContentType(rawMime)
  if (isSupportedStickerMime(mime)) return mime
  return sniffStickerMimeFromBytes(buf) ?? guessStickerMimeFromUrl(url)
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode(...sub)
  }
  return btoa(binary)
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image_load_failed'))
    img.src = src
  })
}

async function fetchStickerBytes(url: string): Promise<{ base64: string; mime: WeChatImageMime }> {
  let resp: Response
  try {
    resp = await fetch(url, { mode: 'cors' })
  } catch {
    resp = await fetch(url)
  }
  if (!resp.ok) throw new Error(`sticker_fetch_failed:${resp.status}`)
  const buf = await resp.arrayBuffer()
  const mime = resolveStickerMime(resp.headers.get('content-type') ?? '', url, buf)
  if (!mime) throw new Error('unsupported_sticker_mime')
  return { base64: arrayBufferToBase64(buf), mime }
}

export async function stickerUrlToImagePayload(url: string): Promise<{ base64: string; mime: WeChatImageMime }> {
  const raw = url.trim()
  if (!raw) throw new Error('empty_sticker_url')
  const parsed = parseDataUrlParts(raw)
  if (parsed?.base64) {
    if (isSupportedStickerMime(parsed.mime)) {
      return { base64: parsed.base64, mime: parsed.mime }
    }
    const sniffed = sniffStickerMimeFromBase64(parsed.base64)
    if (sniffed) return { base64: parsed.base64, mime: sniffed }
  }
  if (!parsed) {
    try {
      const fetched = await fetchStickerBytes(raw)
      if (fetched.mime === 'image/gif' || fetched.mime === 'image/webp') return fetched
      if (isSupportedStickerMime(fetched.mime)) return fetched
    } catch {
      // 非 URL 资源或 fetch 失败时，再尝试静态图 rasterize
    }
  }

  const guessed = guessStickerMimeFromUrl(raw)
  if (guessed === 'image/gif' || guessed === 'image/webp') {
    throw new Error('sticker_animated_fetch_failed')
  }

  let src = raw
  let revokeUrl: string | null = null
  try {
    if (!parsed) {
      const resp = await fetch(raw)
      if (!resp.ok) throw new Error(`sticker_fetch_failed:${resp.status}`)
      const buf = await resp.arrayBuffer()
      const sniffed = resolveStickerMime(resp.headers.get('content-type') ?? '', raw, buf)
      if (sniffed === 'image/gif' || sniffed === 'image/webp') {
        return { base64: arrayBufferToBase64(buf), mime: sniffed }
      }
      src = URL.createObjectURL(new Blob([buf]))
      revokeUrl = src
    }
    const img = await loadImageElement(src)
    const width = Math.max(1, img.naturalWidth || img.width || 1)
    const height = Math.max(1, img.naturalHeight || img.height || 1)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas_ctx_unavailable')
    ctx.drawImage(img, 0, 0, width, height)
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const jpeg = parseDataUrlParts(jpegDataUrl)
    if (!jpeg?.base64) throw new Error('jpeg_encode_failed')
    return { base64: jpeg.base64, mime: 'image/jpeg' }
  } finally {
    if (revokeUrl) URL.revokeObjectURL(revokeUrl)
  }
}

export function arrayBufferToBase64ForMedia(buf: ArrayBuffer): string {
  return arrayBufferToBase64(buf)
}
