import {
  APIZERO_CONTENT_EXTRACT_URL,
  APIZERO_VIDEO_PARSE_URL,
  buildApizeroFetchInit,
  buildApizeroRequestUrl,
} from '../../api/linkPreviewSettingsUtils'
import { getLinkPreviewQuotaSnapshot, recordLinkPreviewQuotaUsage } from '../../api/linkPreviewQuota'
import {
  dispatchLinkPreviewFailureToast,
  dispatchLinkPreviewQuotaToast,
} from '../../api/linkPreviewQuotaEvents'
import { formatLinkPreviewUserFailureMessage } from './formatLinkPreviewUserFailureMessage'
import { getLinkPreviewApiBase, getLinkPreviewSettings } from './linkPreviewApiConfig'
import { isVideoPlatformLink } from './linkPreviewHostPolicy'
import { normalizeShareUrlForParse } from './normalizeShareUrlForParse'
import {
  formatApizeroFetchError,
} from './formatApizeroFetchError'
import { enrichLinkPreviewsWithVision, type LinkPreviewVisionMedia } from './linkPreviewVision'

export type LinkPreviewItem = {
  url: string
  ok: boolean
  title?: string
  description?: string
  excerpt?: string
  error?: string
  /** web=网页正文；video=短视频/图文平台元数据 */
  previewKind?: 'web' | 'video'
  /** 供 vision 识图/截帧的媒体引用 */
  mediaRefs?: LinkPreviewVisionMedia[]
  /** 已用 chatCard vision 模型补充图文/视频画面描述 */
  visionEnriched?: boolean
}

const PREVIEW_TIMEOUT_MS = 15_000

type ApizeroExtractResponse = {
  code?: number
  msg?: string
  data?: {
    title?: string
    publish_time?: string
    content?: string
    word_count?: number
    reading_time?: string
    images?: string[]
  }
}

type ApizeroVideoParsePayload = {
  platform?: string
  type?: string
  title?: string
  cover_url?: string
  video_url?: string
  audio_url?: string
  source?: { author?: string; platform?: string; copyright?: string; original_url?: string }
  stats?: {
    like_count?: number
    comment_count?: number
    share_count?: number
    play_count?: number
    collect_count?: number
    publish_time?: string
  }
  imagelist?: string[]
}

function buildMediaRefsFromVideoParse(d: ApizeroVideoParsePayload): LinkPreviewVisionMedia[] {
  const refs: LinkPreviewVisionMedia[] = []
  const imagelist = Array.isArray(d.imagelist) ? d.imagelist : []
  for (const url of imagelist) {
    const u = String(url ?? '').trim()
    if (u) refs.push({ kind: 'image', url: u })
  }
  const videoUrl = d.video_url?.trim()
  if (videoUrl) refs.push({ kind: 'video', url: videoUrl })
  const coverUrl = d.cover_url?.trim()
  if (coverUrl && !imagelist.length) refs.push({ kind: 'video_cover', url: coverUrl })
  return refs
}

function buildMediaRefsFromContentExtract(images: string[] | undefined): LinkPreviewVisionMedia[] {
  if (!Array.isArray(images)) return []
  return images
    .map((url) => String(url ?? '').trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((url) => ({ kind: 'image' as const, url }))
}

type ApizeroVideoParseResponse = {
  code?: number
  msg?: string
  data?: ApizeroVideoParsePayload | { data?: ApizeroVideoParsePayload }
}

function unwrapVideoParsePayload(data: ApizeroVideoParseResponse['data']): ApizeroVideoParsePayload | null {
  if (!data || typeof data !== 'object') return null
  if ('title' in data || 'platform' in data || 'type' in data) {
    return data as ApizeroVideoParsePayload
  }
  const nested = (data as { data?: ApizeroVideoParsePayload }).data
  return nested && typeof nested === 'object' ? nested : null
}

function trackApizeroQuota(
  kind: 'web' | 'video',
  headers: Headers,
  apiCode: number | undefined,
  apiMsg: string | undefined,
  billable: boolean,
  bodyData?: unknown,
): void {
  try {
    recordLinkPreviewQuotaUsage(kind, { billable, apiCode, apiMsg, headers, bodyData })
  } catch {
    // 额度统计失败不应阻断聊天
  }
}

async function fetchApizeroContentExtract(
  pageUrl: string,
  endpoint: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<LinkPreviewItem> {
  const res = await fetch(
    buildApizeroRequestUrl(endpoint, { url: pageUrl }),
    buildApizeroFetchInit(apiKey, signal),
  )
  let data: ApizeroExtractResponse | null = null
  try {
    data = (await res.json()) as ApizeroExtractResponse
  } catch {
    data = null
  }
  const apiCode = data?.code
  trackApizeroQuota('web', res.headers, apiCode, data?.msg, apiCode === 0 && Boolean(data?.data), data?.data)

  if (!data) {
    return { url: pageUrl, ok: false, error: '响应不是 JSON', previewKind: 'web' }
  }
  if (!res.ok || apiCode !== 0 || !data.data) {
    return {
      url: pageUrl,
      ok: false,
      error: formatApizeroFetchError(res.status, apiCode, data.msg, '正文提取失败'),
      previewKind: 'web',
    }
  }
  const d = data.data
  const title = d.title?.trim()
  const content = d.content?.trim()
  const metaParts = [
    d.publish_time?.trim() ? `发布时间：${d.publish_time.trim()}` : '',
    typeof d.word_count === 'number' && d.word_count > 0 ? `约 ${d.word_count} 字` : '',
    d.reading_time?.trim() ? `阅读约 ${d.reading_time.trim()}` : '',
  ].filter(Boolean)
  const mediaRefs = buildMediaRefsFromContentExtract(d.images)
  return {
    url: pageUrl,
    ok: Boolean(title || content),
    title: title || undefined,
    description: metaParts.join(' · ') || undefined,
    excerpt: content || undefined,
    error: title || content ? undefined : '未能提取正文',
    previewKind: 'web',
    mediaRefs: mediaRefs.length ? mediaRefs : undefined,
  }
}

function formatVideoParseExcerpt(d: ApizeroVideoParsePayload): string {
  const lines: string[] = []
  if (d.platform?.trim()) lines.push(`平台：${d.platform.trim()}`)
  if (d.type?.trim()) lines.push(`类型：${d.type.trim()}`)
  if (d.source?.author?.trim()) lines.push(`作者：${d.source.author.trim()}`)
  const pt = d.stats?.publish_time?.trim()
  if (pt) lines.push(`发布：${pt}`)
  const statsParts = [
    typeof d.stats?.play_count === 'number' ? `播放 ${d.stats.play_count}` : '',
    typeof d.stats?.like_count === 'number' ? `点赞 ${d.stats.like_count}` : '',
    typeof d.stats?.comment_count === 'number' ? `评论 ${d.stats.comment_count}` : '',
  ].filter(Boolean)
  if (statsParts.length) lines.push(`互动：${statsParts.join(' · ')}`)
  if (d.type?.includes('图文') && Array.isArray(d.imagelist) && d.imagelist.length) {
    lines.push(`图文共 ${d.imagelist.length} 张`)
  }
  if (d.video_url?.trim()) {
    lines.push('含视频文件，将尝试识图分析画面')
  }
  lines.push('说明：以下为分享链接的公开元数据；若已配置 vision 模型，系统会进一步识图补充画面内容。')
  return lines.join('\n')
}

async function fetchApizeroVideoParse(
  pageUrl: string,
  endpoint: string,
  apiKey: string,
  signal: AbortSignal,
  displayUrl = pageUrl,
): Promise<LinkPreviewItem> {
  const res = await fetch(
    buildApizeroRequestUrl(endpoint, { url: pageUrl, flat: '1' }),
    buildApizeroFetchInit(apiKey, signal),
  )
  let data: ApizeroVideoParseResponse | null = null
  try {
    data = (await res.json()) as ApizeroVideoParseResponse
  } catch {
    data = null
  }
  const apiCode = data?.code
  trackApizeroQuota('video', res.headers, apiCode, data?.msg, apiCode === 0, data?.data)

  if (!data) {
    return { url: displayUrl, ok: false, error: '响应不是 JSON', previewKind: 'video' }
  }
  if (!res.ok || apiCode !== 0) {
    return {
      url: displayUrl,
      ok: false,
      error: formatApizeroFetchError(res.status, apiCode, data.msg, '视频解析失败'),
      previewKind: 'video',
    }
  }
  const payload = unwrapVideoParsePayload(data.data)
  if (!payload) {
    return { url: displayUrl, ok: false, error: '解析结果为空', previewKind: 'video' }
  }
  const title = payload.title?.trim()
  const excerpt = formatVideoParseExcerpt(payload)
  const platformLabel = payload.platform?.trim() || '短视频'
  const mediaRefs = buildMediaRefsFromVideoParse(payload)
  return {
    url: displayUrl,
    ok: Boolean(title || excerpt),
    title: title || `${platformLabel}分享`,
    description: `${platformLabel}${payload.type ? ` · ${payload.type}` : ''}`,
    excerpt,
    error: title || excerpt ? undefined : '未能解析视频元数据',
    previewKind: 'video',
    mediaRefs: mediaRefs.length ? mediaRefs : undefined,
  }
}

async function fetchApizeroVideoParseWithRetry(
  pageUrl: string,
  endpoint: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<LinkPreviewItem> {
  const first = await fetchApizeroVideoParse(pageUrl, endpoint, apiKey, signal, pageUrl)
  if (first.ok) return first

  const normalized = normalizeShareUrlForParse(pageUrl)
  if (normalized === pageUrl) return first

  const second = await fetchApizeroVideoParse(normalized, endpoint, apiKey, signal, pageUrl)
  return second.ok ? second : first
}

async function fetchLegacyLumiPreviews(
  urls: string[],
  base: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<LinkPreviewItem[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = apiKey.trim()
  if (key) headers.Authorization = `Bearer ${key}`

  const res = await fetch(`${base.replace(/\/+$/, '')}/preview`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ urls }),
    signal,
  })
  if (!res.ok) return []
  let data: { ok?: boolean; previews?: LinkPreviewItem[] }
  try {
    data = (await res.json()) as { ok?: boolean; previews?: LinkPreviewItem[] }
  } catch {
    return []
  }
  if (!data.ok || !Array.isArray(data.previews)) return []
  return data.previews
}

export type FetchLinkPreviewsOptions = {
  /** 聊天消耗时弹出剩余额度提示 */
  notifyQuota?: boolean
  /** 失败时弹全屏 toast；聊天里改由输入框上方提示，避免重复 */
  failureToast?: boolean
}

function publishLinkPreviewFetchNotifications(
  results: LinkPreviewItem[],
  key: string,
  options: FetchLinkPreviewsOptions,
): void {
  if (!options.notifyQuota) return
  try {
    const consumed = {
      web: results.filter((r) => r.previewKind === 'web' && r.ok).length,
      video: results.filter((r) => r.previewKind === 'video' && r.ok).length,
    }
    if (consumed.web > 0 || consumed.video > 0) {
      dispatchLinkPreviewQuotaToast({
        consumed,
        snapshot: getLinkPreviewQuotaSnapshot(key),
      })
    }
    const failureMsg = formatLinkPreviewUserFailureMessage(results)
    if (failureMsg && options.failureToast !== false) {
      dispatchLinkPreviewFailureToast({ message: failureMsg })
    }
  } catch {
    // ignore toast failures
  }
}

function failedPreviewItems(urls: string[], error: string): LinkPreviewItem[] {
  return urls.map((url) => ({
    url,
    ok: false,
    error,
    previewKind: isVideoPlatformLink(url) ? 'video' : 'web',
  }))
}

function linkPreviewFetchErrorMessage(e: unknown): string {
  if (e instanceof DOMException && e.name === 'AbortError') return '请求超时'
  if (e instanceof Error && /abort/i.test(e.message)) return '请求超时'
  return '请求超时或网络错误'
}

function shouldUseApizeroWebExtract(envBase: string): boolean {
  return !envBase || envBase.includes('apizero.cn')
}

async function fetchOneLinkPreview(
  url: string,
  settings: ReturnType<typeof getLinkPreviewSettings>,
  envBase: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<LinkPreviewItem> {
  if (settings.videoParseEnabled && isVideoPlatformLink(url)) {
    return fetchApizeroVideoParseWithRetry(url, APIZERO_VIDEO_PARSE_URL, apiKey, signal)
  }
  if (shouldUseApizeroWebExtract(envBase)) {
    return fetchApizeroContentExtract(url, APIZERO_CONTENT_EXTRACT_URL, apiKey, signal)
  }
  const legacy = await fetchLegacyLumiPreviews([url], envBase, apiKey, signal)
  return (
    legacy[0] ?? {
      url,
      ok: false,
      error: '网页预览服务无响应',
      previewKind: 'web',
    }
  )
}

export async function fetchLinkPreviews(
  urls: string[],
  options: FetchLinkPreviewsOptions = {},
): Promise<LinkPreviewItem[]> {
  const settings = getLinkPreviewSettings()
  const list = urls.map((u) => u.trim()).filter(Boolean).slice(0, 3)
  if (!list.length) return []

  const key = settings.apiKey.trim()
  const envBase = getLinkPreviewApiBase()

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS)
  try {
    const results = await Promise.all(
      list.map((url) => fetchOneLinkPreview(url, settings, envBase, key, controller.signal)),
    )
    window.clearTimeout(timer)

    const enriched = await enrichLinkPreviewsWithVision(results)

    publishLinkPreviewFetchNotifications(enriched, key, options)

    return enriched
  } catch (e) {
    const failed = failedPreviewItems(list, linkPreviewFetchErrorMessage(e))
    publishLinkPreviewFetchNotifications(failed, key, options)
    return failed
  } finally {
    window.clearTimeout(timer)
  }
}
