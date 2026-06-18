export interface Env {}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

const APIZERO_ORIGIN = 'https://v1.apizero.cn'

/** 转发极数本源 v1（GitHub Pages / 静态站与 dev `/apizero-proxy` 同源行为） */
async function proxyApizeroRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const upstreamPath = url.pathname.replace(/^\/apizero-proxy/, '')
  if (!upstreamPath.startsWith('/api/')) {
    return json({ ok: false, message: 'Invalid apizero proxy path' }, 404)
  }
  const upstreamUrl = `${APIZERO_ORIGIN}${upstreamPath}${url.search}`
  const headers = new Headers()
  const auth = request.headers.get('Authorization')
  if (auth) headers.set('Authorization', auth)
  headers.set('Accept', 'application/json')

  const res = await fetch(upstreamUrl, { method: 'GET', headers })
  const outHeaders = new Headers(CORS)
  outHeaders.set('Content-Type', res.headers.get('content-type') ?? 'application/json; charset=utf-8')
  for (const [key, value] of res.headers.entries()) {
    const lower = key.toLowerCase()
    if (lower.startsWith('x-ratelimit') || lower === 'retry-after') {
      outHeaders.set(key, value)
    }
  }
  return new Response(res.body, { status: res.status, headers: outHeaders })
}

const MAX_URLS = 3
const MAX_HTML_BYTES = 512_000
const FETCH_TIMEOUT_MS = 12_000
const MAX_EXCERPT_CHARS = 1200

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  '::1',
  'metadata.google.internal',
  'metadata.goog',
])

type PreviewItem = {
  url: string
  ok: boolean
  title?: string
  description?: string
  excerpt?: string
  error?: string
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  })
}

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return false
  const parts = m.slice(1).map((x) => Number(x))
  if (parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (!host) return true
  if (BLOCKED_HOSTS.has(host)) return true
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true
  if (isPrivateIpv4(host)) return true
  if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true
  return false
}

function validatePublicHttpsUrl(raw: string): URL | null {
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  if (parsed.username || parsed.password) return null
  const port = parsed.port ? Number(parsed.port) : 443
  if (port !== 443) return null
  if (isBlockedHost(parsed.hostname)) return null
  return parsed
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function sanitizePreviewPlainText(raw: string, max: number): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function readMetaContent(html: string, key: string, attr: 'name' | 'property'): string {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    'i',
  )
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
    'i',
  )
  return decodeHtmlEntities(html.match(re)?.[1] ?? html.match(re2)?.[1] ?? '').trim()
}

function extractTitle(html: string): string {
  const og = readMetaContent(html, 'og:title', 'property')
  if (og) return og
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  return decodeHtmlEntities(title ?? '').replace(/\s+/g, ' ').trim()
}

function extractDescription(html: string): string {
  const og = readMetaContent(html, 'og:description', 'property')
  if (og) return og
  const desc = readMetaContent(html, 'description', 'name')
  if (desc) return desc
  return readMetaContent(html, 'twitter:description', 'name')
}

function extractBodyExcerpt(html: string): string {
  const article = html.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)?.[1]
  const main = html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)?.[1]
  const body = html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i)?.[1] ?? html
  const source = article || main || body
  const text = decodeHtmlEntities(
    source
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
  return text.slice(0, MAX_EXCERPT_CHARS).trim()
}

async function fetchHtmlWithGuards(startUrl: URL): Promise<{ html: string; finalUrl: string }> {
  let current = startUrl
  for (let hop = 0; hop < 5; hop++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'LumiLinkPreview/1.0 (+https://github.com/Lumi-Phone)',
        },
      })
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (!location) throw new Error('重定向缺少 Location')
        const next = new URL(location, current)
        const validated = validatePublicHttpsUrl(next.toString())
        if (!validated) throw new Error('重定向目标不允许')
        current = validated
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new Error('非 HTML 页面')
      }
      const buf = await res.arrayBuffer()
      if (buf.byteLength > MAX_HTML_BYTES) throw new Error('页面过大')
      const html = new TextDecoder('utf-8').decode(buf)
      return { html, finalUrl: current.toString() }
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error('重定向次数过多')
}

async function previewOne(rawUrl: string): Promise<PreviewItem> {
  const validated = validatePublicHttpsUrl(rawUrl)
  if (!validated) {
    return { url: rawUrl, ok: false, error: '仅支持公开 https 链接' }
  }
  try {
    const { html, finalUrl } = await fetchHtmlWithGuards(validated)
    const title = sanitizePreviewPlainText(extractTitle(html), 240)
    const description = sanitizePreviewPlainText(extractDescription(html), 480)
    const excerpt = sanitizePreviewPlainText(extractBodyExcerpt(html), MAX_EXCERPT_CHARS)
    if (!title && !description && !excerpt) {
      return { url: finalUrl, ok: false, error: '未能提取正文' }
    }
    return {
      url: finalUrl,
      ok: true,
      title: title || undefined,
      description: description || undefined,
      excerpt: excerpt || undefined,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { url: validated.toString(), ok: false, error: msg || '抓取失败' }
  }
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/'

    try {
      if (request.method === 'GET' && path.startsWith('/apizero-proxy/')) {
        return await proxyApizeroRequest(request)
      }

      if (request.method === 'GET' && path === '/health') {
        return json({ ok: true, service: 'link-preview', apizeroProxy: true })
      }

      if (request.method === 'POST' && path === '/preview') {
        const body = (await request.json()) as { url?: string; urls?: string[] }
        const list = [
          ...(Array.isArray(body.urls) ? body.urls : []),
          ...(body.url?.trim() ? [body.url.trim()] : []),
        ]
          .map((u) => String(u ?? '').trim())
          .filter(Boolean)
        const unique = [...new Set(list)].slice(0, MAX_URLS)
        if (!unique.length) return json({ ok: false, message: '缺少 url 或 urls' }, 400)

        const previews = await Promise.all(unique.map((u) => previewOne(u)))
        return json({ ok: true, previews })
      }

      return json({ ok: false, message: 'Not Found' }, 404)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return json({ ok: false, message: msg }, 500)
    }
  },
}
