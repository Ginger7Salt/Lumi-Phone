import { loadResolvedApiConfig } from '../../api/loadResolvedApiConfig'
import type { ApiConfig } from '../../api/types'
import { openAiCompatibleChatAny } from '../newFriendsPersona/ai'
import type { LinkPreviewItem } from './fetchLinkPreviews'

const MAX_IMAGES = 4
const MAX_VIDEO_FRAMES = 3
const VISION_TIMEOUT_MS = 45_000
const IMAGE_FETCH_TIMEOUT_MS = 12_000

export type LinkPreviewVisionMedia = {
  kind: 'image' | 'video_frame' | 'video_cover' | 'video'
  url: string
}

function clip(s: string, max: number): string {
  const t = s.trim()
  if (!t) return ''
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function isVisionApiReady(cfg: ApiConfig | null): cfg is ApiConfig {
  return Boolean(cfg?.apiUrl?.trim() && cfg?.apiKey?.trim() && cfg?.modelId?.trim())
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(`${label}超时`)), ms)
      }),
    ])
  } finally {
    if (timer != null) window.clearTimeout(timer)
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}

/** 尽量转为 vision 可用的 data URL；失败则退回原 https 链（由上游模型拉取） */
async function resolveVisionImageUrl(rawUrl: string): Promise<string> {
  const url = rawUrl.trim()
  if (!url) return ''
  if (/^data:image\//i.test(url)) return url
  try {
    const res = await withTimeout(
      fetch(url, { mode: 'cors', credentials: 'omit' }),
      IMAGE_FETCH_TIMEOUT_MS,
      '图片下载',
    )
    if (!res.ok) return url
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return url
    return await blobToDataUrl(blob)
  } catch {
    return url
  }
}

async function captureVideoFrameDataUrl(videoUrl: string, timeSec: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      video.removeAttribute('src')
      video.load()
      fn()
    }
    const timer = window.setTimeout(() => finish(() => reject(new Error('视频帧超时'))), 14_000)
    video.onloadedmetadata = () => {
      const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
      const t = dur > 0 ? Math.min(Math.max(0, timeSec), Math.max(0, dur - 0.05)) : 0
      video.currentTime = t
    }
    video.onseeked = () => {
      try {
        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) {
          finish(() => reject(new Error('视频尺寸无效')))
          return
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          finish(() => reject(new Error('无法绘制视频帧')))
          return
        }
        ctx.drawImage(video, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
        window.clearTimeout(timer)
        finish(() => resolve(dataUrl))
      } catch (e) {
        window.clearTimeout(timer)
        finish(() => reject(e instanceof Error ? e : new Error(String(e))))
      }
    }
    video.onerror = () => {
      window.clearTimeout(timer)
      finish(() => reject(new Error('视频加载失败')))
    }
    video.src = videoUrl
  })
}

async function collectVideoFrameUrls(videoUrl: string): Promise<string[]> {
  const out: string[] = []
  for (const sec of [0, 2, 5].slice(0, MAX_VIDEO_FRAMES)) {
    try {
      const frame = await captureVideoFrameDataUrl(videoUrl, sec)
      if (frame) out.push(frame)
    } catch {
      // 单帧失败继续
    }
    if (out.length >= MAX_VIDEO_FRAMES) break
  }
  return out
}

function buildVisionMessages(intro: string, imageUrls: string[]): unknown[] {
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: intro }]
  for (const url of imageUrls) {
    content.push({ type: 'image_url', image_url: { url } })
  }
  return [
    {
      role: 'system',
      content:
        '你是链接内容识别助手。只根据给定图片/视频帧描述可见文字与画面，使用简体中文，条目清晰，禁止编造看不见的内容。',
    },
    { role: 'user', content },
  ]
}

async function runVisionDescribe(cfg: ApiConfig, intro: string, imageUrls: string[]): Promise<string> {
  if (!imageUrls.length) return ''
  const messages = buildVisionMessages(intro, imageUrls)
  const text = await openAiCompatibleChatAny(cfg, messages, {
    temperature: 0.2,
    max_tokens: 900,
  })
  return clip(text, 1200)
}

export async function describeLinkPreviewImagesWithVision(
  cfg: ApiConfig,
  item: LinkPreviewItem,
  imageUrls: string[],
): Promise<string> {
  const urls = imageUrls.map((u) => u.trim()).filter(Boolean).slice(0, MAX_IMAGES)
  if (!urls.length) return ''
  const resolved = await Promise.all(urls.map((u) => resolveVisionImageUrl(u)))
  const intro = [
    '以下图片来自用户分享的链接，请识别图中文字与主要画面内容（小红书图文/网页插图等）。',
    item.title ? `链接标题：${item.title}` : '',
    item.description ? `摘要：${item.description}` : '',
    '输出格式：',
    '1) 逐张简述（图1、图2…）',
    '2) 若能识别大段文字，尽量转写',
    '3) 看不清的明确写「无法辨认」',
  ]
    .filter(Boolean)
    .join('\n')
  return runVisionDescribe(cfg, intro, resolved.filter(Boolean))
}

export async function describeLinkPreviewVideoWithVision(
  cfg: ApiConfig,
  item: LinkPreviewItem,
  opts: { videoUrl?: string; coverUrl?: string },
): Promise<string> {
  const frameCandidates: string[] = []
  const videoUrl = opts.videoUrl?.trim()
  if (videoUrl) {
    frameCandidates.push(...(await collectVideoFrameUrls(videoUrl)))
  }
  if (!frameCandidates.length && opts.coverUrl?.trim()) {
    frameCandidates.push(await resolveVisionImageUrl(opts.coverUrl.trim()))
  }
  if (!frameCandidates.length) return ''

  const intro = [
    '以下图片来自用户分享的视频链接（封面或截帧），请描述画面场景、可见文字、人物/物品与大致情节。',
    item.title ? `视频标题：${item.title}` : '',
    '注意：这是短视频截帧，不是完整视频；未出现的口播/剧情不要编造。',
    '输出格式：',
    '1) 画面内容',
    '2) 可见字幕/文字',
    '3) 对视频主题的一句话概括',
  ]
    .filter(Boolean)
    .join('\n')
  return runVisionDescribe(cfg, intro, frameCandidates.filter(Boolean))
}

export async function enrichLinkPreviewItemWithVision(
  item: LinkPreviewItem,
  cfg: ApiConfig,
): Promise<LinkPreviewItem> {
  if (!item.ok) return item
  const media = item.mediaRefs ?? []
  if (!media.length) return item

  const imageUrls = media.filter((m) => m.kind === 'image').map((m) => m.url)
  const videoUrl = media.find((m) => m.kind === 'video')?.url
  const coverUrl = media.find((m) => m.kind === 'video_cover')?.url

  const parts: string[] = []
  try {
    if (imageUrls.length) {
      const imgDesc = await describeLinkPreviewImagesWithVision(cfg, item, imageUrls)
      if (imgDesc) parts.push(`【识图 · 图文内容】\n${imgDesc}`)
    }
    if (videoUrl || coverUrl) {
      const vidDesc = await describeLinkPreviewVideoWithVision(cfg, item, { videoUrl, coverUrl })
      if (vidDesc) parts.push(`【识图 · 视频画面】\n${vidDesc}`)
    }
  } catch {
    return item
  }

  if (!parts.length) return item
  const visionBlock = parts.join('\n\n')
  const baseExcerpt = item.excerpt?.trim() ?? ''
  const excerpt = baseExcerpt
    ? `${baseExcerpt.replace(/（系统未 OCR 图内文字）/g, '').trim()}\n\n${visionBlock}`
    : visionBlock
  return {
    ...item,
    excerpt,
    visionEnriched: true,
  }
}

export async function enrichLinkPreviewsWithVision(items: LinkPreviewItem[]): Promise<LinkPreviewItem[]> {
  let cfg: ApiConfig | null = null
  try {
    cfg = await loadResolvedApiConfig('chatCard')
  } catch {
    cfg = null
  }
  if (!isVisionApiReady(cfg)) return items

  const needsVision = items.some((it) => it.ok && (it.mediaRefs?.length ?? 0) > 0)
  if (!needsVision) return items

  try {
    return await withTimeout(
      Promise.all(items.map((it) => enrichLinkPreviewItemWithVision(it, cfg!))),
      VISION_TIMEOUT_MS,
      '识图',
    )
  } catch {
    return items
  }
}
