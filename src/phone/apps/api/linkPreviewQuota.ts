import {
  APIZERO_BILLING_PLAN_LABELS,
  APIZERO_DEFAULT_LIMITS,
  type ApizeroBillingMeta,
  type ApizeroBillingPeriod,
  type ApizeroBillingPlanKind,
  parseApizeroBillingMeta,
} from './apizeroBilling'
import { API_STORE_STORAGE_KEY } from './linkPreviewSettingsUtils'
import { dispatchLinkPreviewQuotaUpdated } from './linkPreviewQuotaEvents'
import { LINK_PREVIEW_ACTION_LABEL } from './linkPreviewDisplayLabels'

export type LinkPreviewQuotaKind = 'web' | 'video'

export type LinkPreviewQuotaLine = {
  kind: LinkPreviewQuotaKind
  label: string
  limit: number
  remaining: number
  used: number
  period: ApizeroBillingPeriod
  dailyLimit: number | null
  monthlyLimit: number | null
  monthlyRemaining: number | null
}

export type LinkPreviewQuotaSnapshot = {
  mode: 'anonymous' | 'key'
  planKind: ApizeroBillingPlanKind
  planLabel: string
  dateKey: string
  lines: LinkPreviewQuotaLine[]
}

const STORAGE_KEY = 'link-preview-quota-v2'

/** @deprecated 使用 APIZERO_DEFAULT_LIMITS */
export const LINK_PREVIEW_DAILY_LIMITS = {
  web: { anonymous: APIZERO_DEFAULT_LIMITS.web.anonymous, withKey: APIZERO_DEFAULT_LIMITS.web.freeTrialKey },
  video: { anonymous: APIZERO_DEFAULT_LIMITS.video.anonymous, withKey: APIZERO_DEFAULT_LIMITS.video.freeTrialKey },
} as const

type StoredBillingHints = {
  planKind?: ApizeroBillingPlanKind
  planLabel?: string
  period?: ApizeroBillingPeriod
  webDailyLimit?: number | null
  videoDailyLimit?: number | null
  webMonthlyLimit?: number | null
  videoMonthlyLimit?: number | null
}

type StoredDay = StoredBillingHints & {
  dateKey: string
  webUsed: number
  videoUsed: number
  webRemainingHint?: number
  videoRemainingHint?: number
  webMonthlyRemainingHint?: number
  videoMonthlyRemainingHint?: number
}

function todayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function readStoredApiKey(): string {
  try {
    const raw = localStorage.getItem(API_STORE_STORAGE_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { linkPreview?: { apiKey?: string } }
    return typeof parsed.linkPreview?.apiKey === 'string' ? parsed.linkPreview.apiKey.trim() : ''
  } catch {
    return ''
  }
}

function migrateFromV1Store(): StoredDay | null {
  try {
    const raw = localStorage.getItem('link-preview-quota-v1')
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredDay>
    if (parsed.dateKey !== todayKey()) return null
    return {
      dateKey: todayKey(),
      webUsed: Math.max(0, Number(parsed.webUsed ?? 0)),
      videoUsed: Math.max(0, Number(parsed.videoUsed ?? 0)),
      webRemainingHint:
        typeof parsed.webRemainingHint === 'number' ? Math.max(0, parsed.webRemainingHint) : undefined,
      videoRemainingHint:
        typeof parsed.videoRemainingHint === 'number' ? Math.max(0, parsed.videoRemainingHint) : undefined,
    }
  } catch {
    return null
  }
}

function readStore(): StoredDay {
  const base: StoredDay = {
    dateKey: todayKey(),
    webUsed: 0,
    videoUsed: 0,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const migrated = migrateFromV1Store()
      return migrated ?? base
    }
    const parsed = JSON.parse(raw) as Partial<StoredDay>
    if (parsed.dateKey !== todayKey()) return base
    return {
      dateKey: base.dateKey,
      webUsed: Math.max(0, Number(parsed.webUsed ?? 0)),
      videoUsed: Math.max(0, Number(parsed.videoUsed ?? 0)),
      webRemainingHint:
        typeof parsed.webRemainingHint === 'number' ? Math.max(0, parsed.webRemainingHint) : undefined,
      videoRemainingHint:
        typeof parsed.videoRemainingHint === 'number' ? Math.max(0, parsed.videoRemainingHint) : undefined,
      webMonthlyRemainingHint:
        typeof parsed.webMonthlyRemainingHint === 'number'
          ? Math.max(0, parsed.webMonthlyRemainingHint)
          : undefined,
      videoMonthlyRemainingHint:
        typeof parsed.videoMonthlyRemainingHint === 'number'
          ? Math.max(0, parsed.videoMonthlyRemainingHint)
          : undefined,
      planKind: parsed.planKind,
      planLabel: parsed.planLabel,
      period: parsed.period,
      webDailyLimit: parsed.webDailyLimit ?? undefined,
      videoDailyLimit: parsed.videoDailyLimit ?? undefined,
      webMonthlyLimit: parsed.webMonthlyLimit ?? undefined,
      videoMonthlyLimit: parsed.videoMonthlyLimit ?? undefined,
    }
  } catch {
    return base
  }
}

function writeStore(next: StoredDay): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore quota
  }
}

function hasApiKey(apiKey = readStoredApiKey()): boolean {
  return Boolean(apiKey.trim())
}

function fallbackDailyLimit(kind: LinkPreviewQuotaKind, withKey: boolean): number {
  if (kind === 'web') {
    return withKey ? APIZERO_DEFAULT_LIMITS.web.freeTrialKey : APIZERO_DEFAULT_LIMITS.web.anonymous
  }
  return withKey ? APIZERO_DEFAULT_LIMITS.video.freeTrialKey : APIZERO_DEFAULT_LIMITS.video.anonymous
}

function lineFor(kind: LinkPreviewQuotaKind, store: StoredDay, withKey: boolean): LinkPreviewQuotaLine {
  const planKind = store.planKind ?? (withKey ? 'unknown' : 'anonymous')
  const period = store.period ?? (withKey ? 'daily' : 'daily')
  const dailyLimitHint = kind === 'web' ? store.webDailyLimit : store.videoDailyLimit
  const monthlyLimitHint = kind === 'web' ? store.webMonthlyLimit : store.videoMonthlyLimit
  const monthlyRemainingHint =
    kind === 'web' ? store.webMonthlyRemainingHint : store.videoMonthlyRemainingHint

  const fallbackLimit = fallbackDailyLimit(kind, withKey)
  const limit =
    typeof dailyLimitHint === 'number'
      ? dailyLimitHint
      : planKind === 'pay_per_use'
        ? fallbackLimit
        : fallbackLimit

  const used = kind === 'web' ? store.webUsed : store.videoUsed
  const hint = kind === 'web' ? store.webRemainingHint : store.videoRemainingHint
  const remaining =
    typeof hint === 'number' ? Math.min(limit, Math.max(0, hint)) : Math.max(0, limit - used)

  return {
    kind,
    label: kind === 'web' ? '网页正文' : '视频 / 图文',
    limit,
    remaining,
    used: Math.max(0, limit - remaining),
    period,
    dailyLimit: typeof dailyLimitHint === 'number' ? dailyLimitHint : planKind === 'pay_per_use' ? null : limit,
    monthlyLimit: monthlyLimitHint ?? null,
    monthlyRemaining: monthlyRemainingHint ?? null,
  }
}

export function getLinkPreviewQuotaSnapshot(apiKey = readStoredApiKey()): LinkPreviewQuotaSnapshot {
  const store = readStore()
  const withKey = hasApiKey(apiKey)
  const planKind = store.planKind ?? (withKey ? 'unknown' : 'anonymous')
  return {
    mode: withKey ? 'key' : 'anonymous',
    planKind,
    planLabel: store.planLabel ?? APIZERO_BILLING_PLAN_LABELS[planKind],
    dateKey: store.dateKey,
    lines: [lineFor('web', store, withKey), lineFor('video', store, withKey)],
  }
}

function parseHeaderInt(headers: Headers, names: string[]): number | undefined {
  for (const name of names) {
    const raw = headers.get(name)
    if (!raw) continue
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0) return Math.floor(n)
  }
  return undefined
}

function remainingFromQuotaHeaders(headers: Headers | undefined): number | undefined {
  if (!headers) return undefined
  const direct = parseHeaderInt(headers, [
    'x-ratelimit-remaining-daily',
    'x-ratelimit-remaining',
    'X-RateLimit-Remaining-Daily',
    'X-RateLimit-Remaining',
  ])
  if (typeof direct === 'number') return direct
  const limit = parseHeaderInt(headers, ['x-ratelimit-limit-daily', 'X-RateLimit-Limit-Daily'])
  const used = parseHeaderInt(headers, ['x-ratelimit-used', 'X-RateLimit-Used'])
  if (typeof limit === 'number' && typeof used === 'number') {
    return Math.max(0, limit - used)
  }
  return undefined
}

function isAnonymousPoolQuotaBody(bodyData: unknown, kind: LinkPreviewQuotaKind): boolean {
  if (!bodyData || typeof bodyData !== 'object') return false
  const limitDaily = (bodyData as { limit_daily?: unknown }).limit_daily
  if (typeof limitDaily !== 'number') return false
  const anonLimit =
    kind === 'video' ? APIZERO_DEFAULT_LIMITS.video.anonymous : APIZERO_DEFAULT_LIMITS.web.anonymous
  return limitDaily === anonLimit
}

function resolveDailyRemaining(
  headers: Headers | undefined,
  bodyData: unknown,
  apiCode: number | undefined,
  kind: LinkPreviewQuotaKind,
  withKey: boolean,
  meta: ApizeroBillingMeta,
): number | undefined {
  if (
    withKey &&
    (apiCode === 4030 || apiCode === 4015) &&
    isAnonymousPoolQuotaBody(bodyData, kind)
  ) {
    return undefined
  }
  if (meta.period === 'pay_per_use' || meta.planKind === 'pay_per_use') {
    return undefined
  }
  if (typeof meta.dailyRemaining === 'number') return meta.dailyRemaining
  const fromHeader = remainingFromQuotaHeaders(headers)
  if (typeof fromHeader === 'number') return fromHeader
  if (apiCode === 4030 || apiCode === 4015) {
    return withKey ? undefined : 0
  }
  return undefined
}

function applyBillingMetaToStore(store: StoredDay, kind: LinkPreviewQuotaKind, meta: ApizeroBillingMeta): void {
  store.planKind = meta.planKind
  store.planLabel = meta.planLabel
  store.period = meta.period
  if (kind === 'web') {
    store.webDailyLimit = meta.dailyLimit
    store.webMonthlyLimit = meta.monthlyLimit
    if (typeof meta.monthlyRemaining === 'number') store.webMonthlyRemainingHint = meta.monthlyRemaining
  } else {
    store.videoDailyLimit = meta.dailyLimit
    store.videoMonthlyLimit = meta.monthlyLimit
    if (typeof meta.monthlyRemaining === 'number') store.videoMonthlyRemainingHint = meta.monthlyRemaining
  }
}

function applyDailyRemainingToStore(
  kind: LinkPreviewQuotaKind,
  store: StoredDay,
  remaining: number,
  withKey: boolean,
): void {
  const dailyLimitHint = kind === 'web' ? store.webDailyLimit : store.videoDailyLimit
  const limit =
    typeof dailyLimitHint === 'number'
      ? dailyLimitHint
      : fallbackDailyLimit(kind, withKey)
  const clamped = Math.min(limit, Math.max(0, remaining))
  if (kind === 'web') {
    store.webRemainingHint = clamped
    store.webUsed = Math.max(0, limit - clamped)
  } else {
    store.videoRemainingHint = clamped
    store.videoUsed = Math.max(0, limit - clamped)
  }
}

/** 填写/更换 Key 后清掉本机旧的额度缓存 */
export function clearLinkPreviewQuotaStore(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('link-preview-quota-v1')
  } catch {
    // ignore
  }
  dispatchLinkPreviewQuotaUpdated(getLinkPreviewQuotaSnapshot())
}

export function recordLinkPreviewQuotaUsage(
  kind: LinkPreviewQuotaKind,
  options: {
    billable?: boolean
    apiCode?: number
    apiMsg?: string
    headers?: Headers
    bodyData?: unknown
    syncOnly?: boolean
    alwaysNotify?: boolean
  } = {},
): { snapshot: LinkPreviewQuotaSnapshot; syncedFromServer: boolean } {
  const withKey = hasApiKey()
  const store = readStore()
  const billable = options.syncOnly ? false : Boolean(options.billable)

  const meta = parseApizeroBillingMeta(
    options.headers,
    options.bodyData,
    options.apiCode,
    options.apiMsg,
    withKey,
  )
  applyBillingMetaToStore(store, kind, meta)

  const dailyRemaining = resolveDailyRemaining(
    options.headers,
    options.bodyData,
    options.apiCode,
    kind,
    withKey,
    meta,
  )
  const syncedFromServer =
    typeof dailyRemaining === 'number' ||
    typeof meta.monthlyRemaining === 'number' ||
    meta.planKind !== (withKey ? 'unknown' : 'anonymous')

  if (typeof dailyRemaining === 'number') {
    applyDailyRemainingToStore(kind, store, dailyRemaining, withKey)
  } else if (billable && meta.period !== 'pay_per_use' && meta.planKind !== 'pay_per_use') {
    const limit = fallbackDailyLimit(kind, withKey)
    if (kind === 'web') store.webUsed = Math.min(limit, store.webUsed + 1)
    else store.videoUsed = Math.min(limit, store.videoUsed + 1)
    if (kind === 'web') delete store.webRemainingHint
    else delete store.videoRemainingHint
  }

  writeStore(store)

  const snapshot = getLinkPreviewQuotaSnapshot()
  if (billable || options.apiCode === 4030 || options.apiCode === 4015 || options.alwaysNotify) {
    dispatchLinkPreviewQuotaUpdated(snapshot)
  }
  return { snapshot, syncedFromServer }
}

export function formatLinkPreviewQuotaLine(line: LinkPreviewQuotaLine, planKind: ApizeroBillingPlanKind): string {
  if (planKind === 'pay_per_use' || line.period === 'pay_per_use') {
    return `${line.label}：按次付费（无日限额）`
  }
  if (line.period === 'monthly' && line.monthlyLimit != null) {
    const rem = line.monthlyRemaining ?? line.remaining
    return `${line.label} 本月剩余 ${rem}/${line.monthlyLimit} 次`
  }
  return `${line.label} 今日剩余 ${line.remaining}/${line.dailyLimit ?? line.limit} 次`
}

export function formatLinkPreviewQuotaToastMessage(
  consumed: { web: number; video: number },
  snapshot: LinkPreviewQuotaSnapshot,
): string {
  const parts: string[] = []
  if (consumed.web > 0) {
    const line = snapshot.lines.find((l) => l.kind === 'web')
    if (line) parts.push(formatLinkPreviewQuotaLine(line, snapshot.planKind))
  }
  if (consumed.video > 0) {
    const line = snapshot.lines.find((l) => l.kind === 'video')
    if (line) parts.push(formatLinkPreviewQuotaLine(line, snapshot.planKind))
  }
  if (!parts.length) return `${LINK_PREVIEW_ACTION_LABEL}完成`
  return `${LINK_PREVIEW_ACTION_LABEL}已消耗 · ${parts.join(' · ')}`
}

export { parseApizeroBillingMeta, type ApizeroBillingMeta, type ApizeroBillingPlanKind }
