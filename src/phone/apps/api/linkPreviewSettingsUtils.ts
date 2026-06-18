import type { LinkPreviewSettings } from './types'
import { formatApizeroBillingError, isApizeroBalanceInsufficient } from './apizeroBilling'
import {
  getLinkPreviewQuotaSnapshot,
  recordLinkPreviewQuotaUsage,
  type LinkPreviewQuotaKind,
  type LinkPreviewQuotaSnapshot,
} from './linkPreviewQuota'

export const API_STORE_STORAGE_KEY = 'ai-api-presets-v1'

export const APIZERO_OFFICIAL_URL = 'https://apizero.cn'
export const APIZERO_CONTENT_EXTRACT_URL = 'https://v1.apizero.cn/api/content-extract'
export const APIZERO_VIDEO_PARSE_URL = 'https://v1.apizero.cn/api/video-parse'
export const APIZERO_KEY_ACQUIRE_URL = 'https://apizero.cn/account/keys'
/** @deprecated 使用 APIZERO_KEY_ACQUIRE_URL */ export const APIZERO_KEYS_URL = APIZERO_KEY_ACQUIRE_URL
/** Vite dev 同源代理，见 vite.config.ts `/apizero-proxy` */
export const APIZERO_DEV_PROXY_PREFIX = '/apizero-proxy'

/** 生产构建：Cloudflare Worker 上的极数本源代理（见 workers/link-preview） */
export function readEnvApizeroProxyBase(): string {
  const direct = import.meta.env.VITE_APIZERO_PROXY_BASE
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim().replace(/\/+$/, '')
  }
  const legacy = import.meta.env.VITE_LINK_PREVIEW_API_BASE
  if (typeof legacy === 'string' && legacy.trim()) {
    return `${legacy.trim().replace(/\/+$/, '')}/apizero-proxy`
  }
  return ''
}

/** 极数本源 v1；开发走 Vite 代理，GitHub Pages 等走 Worker `/apizero-proxy` */
export function resolveApizeroFetchUrl(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, '')
  try {
    const parsed = new URL(base)
    if (parsed.hostname !== 'v1.apizero.cn') return base

    if (import.meta.env.DEV) {
      return `${APIZERO_DEV_PROXY_PREFIX}${parsed.pathname}`
    }

    const proxyBase = readEnvApizeroProxyBase()
    if (proxyBase) {
      return `${proxyBase}${parsed.pathname}`
    }
  } catch {
    // ignore
  }
  return base
}

/** 与极数本源在线调试一致：Key 走 Authorization Bearer，不用 query `key` */
export function buildApizeroFetchInit(apiKey: string, signal: AbortSignal): RequestInit {
  const key = apiKey.trim()
  const headers: Record<string, string> = {}
  if (key) headers.Authorization = `Bearer ${key}`
  return { method: 'GET', signal, headers }
}

export function buildApizeroRequestUrl(endpoint: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params)
  return `${resolveApizeroFetchUrl(endpoint)}?${qs}`
}

export function isApizeroContentExtractEndpoint(apiBase: string): boolean {
  const base = apiBase.trim().toLowerCase()
  return base.includes('apizero.cn') && base.includes('content-extract')
}

export function isApizeroVideoParseEndpoint(apiBase: string): boolean {
  const base = apiBase.trim().toLowerCase()
  return base.includes('apizero.cn') && base.includes('video-parse')
}

export function createEmptyLinkPreviewSettings(): LinkPreviewSettings {
  return {
    enabled: true,
    apiBase: APIZERO_CONTENT_EXTRACT_URL,
    apiKey: '',
    videoParseEnabled: true,
  }
}

export function normalizeLinkPreviewSettings(raw: unknown): LinkPreviewSettings {
  const base = createEmptyLinkPreviewSettings()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<LinkPreviewSettings>
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : base.enabled,
    apiBase: APIZERO_CONTENT_EXTRACT_URL,
    apiKey: typeof r.apiKey === 'string' ? r.apiKey : base.apiKey,
    videoParseEnabled: true,
    lastTest:
      r.lastTest && typeof r.lastTest === 'object'
        ? {
            ok: !!(r.lastTest as { ok?: unknown }).ok,
            message: String((r.lastTest as { message?: unknown }).message ?? ''),
            at: Number((r.lastTest as { at?: unknown }).at ?? 0),
          }
        : undefined,
  }
}

export function mergeApiStoreLinkPreview(store: { linkPreview?: unknown }): { linkPreview: LinkPreviewSettings } {
  return { linkPreview: normalizeLinkPreviewSettings(store.linkPreview) }
}

/** 同步读取（ChatRoom 发消息前调用） */
export function readLinkPreviewSettingsSync(): LinkPreviewSettings {
  const normalized = (() => {
    try {
      const raw = localStorage.getItem(API_STORE_STORAGE_KEY)
      if (!raw) return createEmptyLinkPreviewSettings()
      const parsed = JSON.parse(raw) as { linkPreview?: unknown }
      return normalizeLinkPreviewSettings(parsed.linkPreview)
    } catch {
      return createEmptyLinkPreviewSettings()
    }
  })()

  if (!normalized.enabled) {
    return { ...normalized, apiBase: '' }
  }

  return { ...normalized, apiBase: APIZERO_CONTENT_EXTRACT_URL, videoParseEnabled: true }
}

export function resolveLinkPreviewApiBase(settings = readLinkPreviewSettingsSync()): string {
  if (!settings.enabled) return ''
  return APIZERO_CONTENT_EXTRACT_URL
}

/** 启用即可用（极数本源支持无 Key 匿名免费额度） */
export function isLinkPreviewReady(settings = readLinkPreviewSettingsSync()): boolean {
  return settings.enabled
}

export async function testLinkPreviewConnection(
  apiBase: string,
  apiKey = '',
): Promise<{ ok: boolean; message: string }> {
  const base = apiBase.trim().replace(/\/+$/, '')
  if (!base) return { ok: false, message: '请先填写服务地址' }

  if (isApizeroContentExtractEndpoint(base) || isApizeroVideoParseEndpoint(base)) {
    const key = apiKey.trim()
    const video = isApizeroVideoParseEndpoint(base)
    try {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 12_000)
      const params: Record<string, string> = {
        url: video ? 'https://www.bilibili.com/video/BV1gY411A7y7' : 'https://example.com',
      }
      if (video) params.flat = '1'
      const res = await fetch(buildApizeroRequestUrl(base, params), buildApizeroFetchInit(key, controller.signal))
      window.clearTimeout(timer)
      const kind = video ? 'video' : 'web'
      type ApizeroProbeResponse = { code?: number; msg?: string; data?: unknown }
      let data: ApizeroProbeResponse | null = null
      try {
        data = (await res.json()) as ApizeroProbeResponse
      } catch {
        if (!res.ok) return { ok: false, message: `HTTP ${res.status}` }
        return { ok: false, message: '响应不是 JSON' }
      }

      const apiCode = data?.code
      const apiMsg = data?.msg?.trim() || ''
      recordLinkPreviewQuotaUsage(kind, {
        billable: apiCode === 0 && Boolean(data?.data),
        apiCode,
        apiMsg,
        headers: res.headers,
        bodyData: data?.data,
      })

      if (apiCode === 0 && data?.data) {
        const mode = key ? '' : '（匿名免费额度）'
        return {
          ok: true,
          message: video ? `视频解析连接成功${mode}` : `正文提取连接成功${mode}`,
        }
      }

      if (res.status === 429 || apiCode === 4030 || apiCode === 4015) {
        if (isApizeroBalanceInsufficient(apiCode, apiMsg)) {
          return { ok: false, message: formatApizeroBillingError(apiCode, apiMsg, '账户余额不足') }
        }
        if (apiCode === 4029) {
          return {
            ok: false,
            message: apiMsg || '调用过快，请等待 1～2 秒后再点测试',
          }
        }
        return {
          ok: false,
          message: formatApizeroBillingError(apiCode, apiMsg, '今日额度已用完'),
        }
      }

      if (!res.ok) return { ok: false, message: apiMsg || `HTTP ${res.status}` }
      return { ok: false, message: apiMsg || `接口返回 code=${apiCode ?? '?'}` }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/abort/i.test(msg)) return { ok: false, message: '连接超时' }
      return { ok: false, message: msg || '连接失败' }
    }
  }

  try {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 8_000)
    const res = await fetch(`${base}/health`, { signal: controller.signal })
    window.clearTimeout(timer)
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` }
    let data: { ok?: boolean; service?: string } | null = null
    try {
      data = (await res.json()) as { ok?: boolean; service?: string }
    } catch {
      return { ok: false, message: '响应不是 JSON' }
    }
    if (data?.ok) {
      return { ok: true, message: data.service ? `已连接（${data.service}）` : '连接成功' }
    }
    return { ok: false, message: '服务未返回 ok' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/abort/i.test(msg)) return { ok: false, message: '连接超时' }
    return { ok: false, message: msg || '连接失败' }
  }
}

const QUOTA_PROBE_TIMEOUT_MS = 12_000
const QUOTA_PROBE_GAP_MS = 1100
/** 故意无效的探测 URL：只读额度响应头，不触发有效解析计费 */
const QUOTA_SYNC_PROBE_URL = 'https://quota-sync.invalid/'

async function probeLinkPreviewQuotaEndpoint(
  endpoint: string,
  apiKey: string,
  kind: LinkPreviewQuotaKind,
  video: boolean,
): Promise<boolean> {
  const base = endpoint.trim().replace(/\/+$/, '')
  const params: Record<string, string> = { url: QUOTA_SYNC_PROBE_URL }
  const key = apiKey.trim()
  if (video) params.flat = '1'

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), QUOTA_PROBE_TIMEOUT_MS)
  try {
    const res = await fetch(buildApizeroRequestUrl(base, params), buildApizeroFetchInit(key, controller.signal))
    let data: { code?: number; data?: unknown; msg?: string } | null = null
    try {
      data = (await res.json()) as { code?: number; data?: unknown; msg?: string }
    } catch {
      data = null
    }
    const apiCode = data?.code
    const apiMsg = data?.msg?.trim() ?? ''
    const { syncedFromServer } = recordLinkPreviewQuotaUsage(kind, {
      billable: false,
      syncOnly: true,
      apiCode,
      apiMsg,
      headers: res.headers,
      bodyData: data?.data,
      alwaysNotify: true,
    })
    return syncedFromServer
  } finally {
    window.clearTimeout(timer)
  }
}

/** 向极数本源读取额度（无效 URL 探测；已填 Key 时探测失败会 fallback 测试请求同步） */
export async function refreshLinkPreviewQuotaFromServer(
  apiKey = '',
): Promise<{ ok: boolean; message: string; snapshot: LinkPreviewQuotaSnapshot }> {
  try {
    const key = apiKey.trim()
    let videoSynced = await probeLinkPreviewQuotaEndpoint(
      APIZERO_VIDEO_PARSE_URL,
      apiKey,
      'video',
      true,
    )
    await new Promise((r) => window.setTimeout(r, QUOTA_PROBE_GAP_MS))
    let webSynced = await probeLinkPreviewQuotaEndpoint(
      APIZERO_CONTENT_EXTRACT_URL,
      apiKey,
      'web',
      false,
    )
    let syncedViaTest = false

    if (key && !videoSynced) {
      const before = getLinkPreviewQuotaSnapshot(apiKey).lines.find((l) => l.kind === 'video')?.remaining
      await testLinkPreviewConnection(APIZERO_VIDEO_PARSE_URL, apiKey)
      const after = getLinkPreviewQuotaSnapshot(apiKey).lines.find((l) => l.kind === 'video')?.remaining
      if (after !== before) {
        videoSynced = true
        syncedViaTest = true
      }
    }
    if (key && !webSynced) {
      const before = getLinkPreviewQuotaSnapshot(apiKey).lines.find((l) => l.kind === 'web')?.remaining
      await testLinkPreviewConnection(APIZERO_CONTENT_EXTRACT_URL, apiKey)
      const after = getLinkPreviewQuotaSnapshot(apiKey).lines.find((l) => l.kind === 'web')?.remaining
      if (after !== before) {
        webSynced = true
        syncedViaTest = true
      }
    }

    const snapshot = getLinkPreviewQuotaSnapshot(apiKey)
    if (videoSynced || webSynced) {
      return {
        ok: true,
        message: syncedViaTest
          ? '已从服务器同步今日余额（测试请求可能消耗 1 次解析）'
          : '已从服务器同步今日余额（未消耗解析次数）',
        snapshot,
      }
    }
    return {
      ok: true,
      message: key
        ? '轻量探测未读到额度，请点「测试视频解析」同步；或发一条链接后会自动更新'
        : '服务器未返回额度头，仍显示本机记录；解析链接后会自动校准',
      snapshot,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      message: /abort/i.test(msg) ? '同步超时，请稍后再试' : '同步失败，请检查网络',
      snapshot: getLinkPreviewQuotaSnapshot(apiKey),
    }
  }
}
