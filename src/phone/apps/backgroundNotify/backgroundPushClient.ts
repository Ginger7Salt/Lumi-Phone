import {
  getWebPushApiBase,
  getWebPushProvider,
  isWebPushOfflineConfigured,
} from './webPushProviderConfig'
import {
  kickstartKeepAliveAudioFromUserGesture,
  setContinuousKeepAliveEnabled,
  isHtmlKeepAlivePlaying,
  stopBackgroundMediaKeepAlive,
  syncContinuousKeepAlivePlaybackIfEnabled,
} from './backgroundMediaKeepAlive'
import { shouldUseAudioForKeepAlive } from './backgroundKeepAliveStrategy'
import { notifyKeepAliveEnabledFromUserGesture } from './keepAliveBootGate'
import { resolveOsNotificationIconUrl } from './notificationIconUrl'
import { supportsPerNotificationCustomIcon } from '../../utils/platform'

export {
  getLumiPushApiBase,
  getWebPushApiBase,
  getWebPushProvider,
  getWebPushProviderLabel,
  isPushApiConfigured,
  isWebPushOfflineConfigured,
  OFFLINE_PUSH_VPN_HINT,
  OFFLINE_WEB_PUSH_ARCHITECTURE,
  describeOfflinePushSetupHint,
  type WebPushProviderKind,
} from './webPushProviderConfig'

const CLIENT_ID_KEY = 'lumi-push-client-id'
const ENABLED_KEY = 'lumi-push-enabled'
const KEEPALIVE_ENABLED_KEY = 'lumi-keepalive-enabled'

let cachedSwRegistration: ServiceWorkerRegistration | null = null
let cachedSwRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null
let lastServiceWorkerRegisterError: string | null = null

function isLikelyAndroidBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

/** iPhone / iPad Safari 或「添加到主屏幕」PWA */
export function isLikelyIosBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/** 本机 dev + 安卓：Edge/Chrome 对 IP+自签证书 SW 接管极不稳定，通知走降级通道 */
export function isDevAndroidLocalNotifyMode(): boolean {
  return !!import.meta.env.DEV && isLikelyAndroidBrowser()
}

/** 本机 dev + iOS：添加到主屏幕后 SW 自动刷新易与白屏/死循环；放宽接管要求 */
export function isDevIosLocalPwaMode(): boolean {
  return !!import.meta.env.DEV && isLikelyIosBrowser()
}

function shouldAutoReloadForServiceWorkerControl(): boolean {
  if (isDevAndroidLocalNotifyMode() || isDevIosLocalPwaMode()) return false
  if (isLikelyIosBrowser()) return false
  return true
}

export function isBackgroundNotifyOperational(permission: PushPermissionState, pageControlled: boolean): boolean {
  if (permission !== 'granted') return false
  if (pageControlled) return true
  if (isDevAndroidLocalNotifyMode() || isDevIosLocalPwaMode()) return true
  /** 正式版 iOS：未接管时仍允许本地通知降级，勿因 SW 刷新把整页打白 */
  if (isLikelyIosBrowser()) return true
  return false
}

function defaultServiceWorkerWaitMs(): number {
  return isLikelyAndroidBrowser() ? 8000 : 3000
}

function normalizeScopePath(base: string): string {
  if (!base || base === '/') return '/'
  return base.endsWith('/') ? base : `${base}/`
}

export function getLumiPushClientId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY)?.trim()
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `lumi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      window.localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

export function isBackgroundPushEnabledLocally(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function isBackgroundKeepAliveEnabledLocally(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = window.localStorage.getItem(KEEPALIVE_ENABLED_KEY)
    if (v === '1') return true
    if (v === '0') return false
    // 迁移：旧版「后台推送」开关同时包含保活
    return window.localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

/** 是否用系统通知栏展示新消息（仅「后台推送」开关，与保活无关） */
export function isBackgroundNotifyFeatureEnabled(): boolean {
  return isBackgroundPushEnabledLocally()
}

export function setBackgroundKeepAliveEnabledLocally(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEEPALIVE_ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** 读取 Push 订阅（不抛错；避免 service worker 未就绪时长时间阻塞 UI） */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1200)),
    ])
    if (!reg) return null
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

/** 解析「后台推送」开关状态（仅 localStorage，与 Web Push 订阅是否成功无关） */
export async function resolveBackgroundPushEnabled(): Promise<boolean> {
  return isBackgroundPushEnabledLocally()
}

export function setBackgroundPushEnabledLocally(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export type PushPermissionState = NotificationPermission | 'unsupported'

export function getPushPermissionState(): PushPermissionState {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/** 网站级通知权限（以 Notification.permission 为准，这是能否弹 OS 通知的关键） */
export function isOsNotificationPermissionGranted(): boolean {
  return getPushPermissionState() === 'granted'
}

function detectMobileBrowserLabel(): string {
  if (typeof navigator === 'undefined') return '浏览器'
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  return '浏览器'
}

/** 权限被拦截时的说明（区分「未弹窗 / 已拒绝 / 需去设置」） */
export function describeNotificationPermissionBlock(permission: PushPermissionState): string {
  if (permission === 'unsupported') {
    return '当前浏览器不支持系统通知，请用 Edge / Chrome 打开（不要用微信、QQ 内置浏览器）'
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return '当前不是 HTTPS 连接，浏览器不会弹出权限窗。请用 https:// 地址访问'
  }
  if (permission === 'default') {
    return '若未看到弹窗，请看 Edge 窗口顶部/地址栏附近是否出现权限条；或到 🔒 → 网站权限 → 通知 手动允许'
  }
  const browser = detectMobileBrowserLabel()
  const devHost =
    typeof window !== 'undefined' && /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)
      ? `（当前 dev 地址 ${window.location.host}，换 IP/端口会被当作新网站）`
      : ''
  return (
    `浏览器读数为「已拒绝」，不会再弹权限窗${devHost}。` +
    `请手动：${browser} 地址栏 🔒 → 此网站 → 通知 → 允许；` +
    `并确认安卓 设置 → 应用 → ${browser} → 通知 已开启`
  )
}

export function canRepromptNotificationPermission(): boolean {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false
  if (!window.isSecureContext) return false
  return Notification.permission === 'default'
}

export function getNotificationPermissionDiagnostics(): {
  permission: PushPermissionState
  secureContext: boolean
  canReprompt: boolean
  noPopupReason: string | null
} {
  const permission = getPushPermissionState()
  const secureContext = typeof window !== 'undefined' && window.isSecureContext
  const canReprompt = canRepromptNotificationPermission()

  let noPopupReason: string | null = null
  if (permission === 'unsupported') {
    noPopupReason = '浏览器不支持 Notification API'
  } else if (!secureContext) {
    noPopupReason = '非 HTTPS，浏览器禁止弹权限窗'
  } else if (permission === 'denied') {
    noPopupReason =
      '浏览器读数为「已拒绝」。dev 换 IP/端口 = 新网站；或到 Edge 🔒 → 此网站 → 通知 → 允许'
  } else if (permission === 'granted') {
    noPopupReason = null
  }

  return { permission, secureContext, canReprompt, noPopupReason }
}

/**
 * 必须在用户 click/tap 的同步回调里立刻调用（之前不能有 setState / await）。
 * 返回已启动的 requestPermission Promise。
 */
export function startNotificationPermissionRequestFromUserGesture(): Promise<PushPermissionState> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return Promise.resolve('unsupported')
  }
  if (Notification.permission === 'granted') return Promise.resolve('granted')
  if (!window.isSecureContext) return Promise.resolve(getPushPermissionState())

  return Notification.requestPermission()
    .then((result): PushPermissionState => {
      if (result === 'granted') return 'granted'
      const perm = Notification.permission
      if (perm === 'granted') return 'granted'
      return perm === 'denied' ? 'denied' : 'default'
    })
    .catch(() => (Notification.permission === 'granted' ? 'granted' : getPushPermissionState()))
}

/** @deprecated 优先在 click 回调里用 startNotificationPermissionRequestFromUserGesture */
export async function requestLumiNotificationPermission(): Promise<PushPermissionState> {
  return startNotificationPermissionRequestFromUserGesture()
}

/**
 * 同步权限。仅以 Notification.permission 为准；
 * Android dev 下 Permissions API 常误报 denied，绝不能用它覆盖浏览器读数。
 */
export async function syncPushPermissionState(): Promise<PushPermissionState> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported'

  const fromNotification = Notification.permission as PushPermissionState
  if (fromNotification === 'granted' || fromNotification === 'denied') {
    return fromNotification
  }

  // 仅允许从 default 升级为 granted（用户刚从系统设置改完权限）
  if ('permissions' in navigator) {
    try {
      const status = await navigator.permissions.query({ name: 'notifications' as PermissionName })
      if (status.state === 'granted') return 'granted'
    } catch {
      /* ignore */
    }
  }

  return 'default'
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

function resolveServiceWorkerScriptUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}sw.js`.replace(/([^:]\/)\/+/g, '$1')
}

export type ServiceWorkerConnectionState =
  | 'unsupported'
  | 'insecure'
  | 'none'
  | 'installing'
  | 'waiting'
  | 'active'

export type WebPushWorkerProbeState =
  | 'unsupported'
  | 'unconfigured'
  | 'connected'
  | 'failed'

export type LumiPushDiagnostics = {
  secureContext: boolean
  serviceWorkerSupported: boolean
  registrationActive: boolean
  pageControlled: boolean
  swInstalled: boolean
  needsPageReload: boolean
  devAndroidBypass: boolean
  swState: ServiceWorkerConnectionState
  swHint: string
  swScriptUrl: string
  swScriptReachable: boolean | null
  registerError: string | null
  offlinePushOperational: boolean
  webPushOfflineConfigured: boolean
  offlinePushEnvironmentSupported: boolean
  workerApiUrl: string
  workerProbeState: WebPushWorkerProbeState
  workerProbeHint: string | null
  offlinePushBlockHint: string | null
}

const SW_CONTROL_RELOAD_FLAG = 'lumi-sw-control-reload'
const SW_CONTROL_RELOAD_COUNT_KEY = 'lumi-sw-control-reload-count'
const SW_CONTROL_RELOAD_MAX = 2
const SW_CONTROL_RELOAD_WINDOW_MS = 60_000
/** 诊断页探测 SW 激活的最长等待，避免整页卡在「检测中」 */
const SW_DIAGNOSTIC_WAIT_MS = 2000

function readSwControlReloadCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(SW_CONTROL_RELOAD_COUNT_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { count?: number; at?: number }
    if (typeof parsed.count !== 'number' || typeof parsed.at !== 'number') return 0
    if (Date.now() - parsed.at > SW_CONTROL_RELOAD_WINDOW_MS) return 0
    return parsed.count
  } catch {
    return 0
  }
}

function markSwControlReload(): void {
  if (typeof window === 'undefined') return
  try {
    const count = readSwControlReloadCount() + 1
    window.localStorage.setItem(SW_CONTROL_RELOAD_COUNT_KEY, JSON.stringify({ count, at: Date.now() }))
    window.sessionStorage.setItem(SW_CONTROL_RELOAD_FLAG, '1')
  } catch {
    /* ignore */
  }
}

function canAutoReloadForServiceWorkerControl(): boolean {
  return readSwControlReloadCount() < SW_CONTROL_RELOAD_MAX
}

export function isPageControlledByServiceWorker(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller
}

export function clearServiceWorkerControlReloadFlag(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(SW_CONTROL_RELOAD_FLAG)
    window.localStorage.removeItem(SW_CONTROL_RELOAD_COUNT_KEY)
  } catch {
    /* ignore */
  }
}

/** SW 首次安装后，当前页不会被接管，必须刷新；安卓 dev 尤其容易卡在这一步 */
export function reloadPageForServiceWorkerControl(): void {
  if (typeof window === 'undefined') return
  window.location.reload()
}

async function ensureServiceWorkerPageControl(options?: { autoReload?: boolean }): Promise<{
  controlled: boolean
  needsPageReload: boolean
  swInstalled: boolean
}> {
  const controlled = isPageControlledByServiceWorker()
  if (controlled) {
    clearServiceWorkerControlReloadFlag()
    return { controlled: true, needsPageReload: false, swInstalled: true }
  }

  const reg = (await readExistingServiceWorkerRegistration()) ?? cachedSwRegistration
  const swInstalled = !!(reg?.active || reg?.waiting)
  const needsPageReload = !!reg?.active && !controlled

  if (needsPageReload && options?.autoReload && canAutoReloadForServiceWorkerControl()) {
    markSwControlReload()
    reloadPageForServiceWorkerControl()
    return { controlled: false, needsPageReload: true, swInstalled: true }
  }

  return { controlled, needsPageReload, swInstalled }
}

/** 监听 SW 激活并在首次安装后自动刷新，让页面被接管 */
export function setupServiceWorkerControlWatcher(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    if (sessionStorage.getItem(SW_CONTROL_RELOAD_FLAG) === '1' && !navigator.serviceWorker.controller) {
      void readExistingServiceWorkerRegistration().then((reg) => {
        if (!reg?.active) clearServiceWorkerControlReloadFlag()
      })
    }
  } catch {
    /* ignore */
  }

  void resolveCachedSwRegistration().then(() =>
    ensureServiceWorkerPageControl({ autoReload: shouldAutoReloadForServiceWorkerControl() }),
  )

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    cachedSwRegistration = null
    void ensureServiceWorkerPageControl({ autoReload: false })
    void resolveCachedSwRegistration()
    void navigator.serviceWorker.ready.catch(() => {})
  })
}

function resolveServiceWorkerScope(): string {
  return normalizeScopePath(import.meta.env.BASE_URL || '/')
}

function isRegistrationStale(reg: ServiceWorkerRegistration | null): boolean {
  if (!reg) return true
  return !reg.active && !reg.installing && !reg.waiting
}

async function readExistingServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration(resolveServiceWorkerScope())) ?? null
}

async function clearAllServiceWorkerRegistrations(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map((r) => r.unregister()))
}

function kickWaitingServiceWorker(reg: ServiceWorkerRegistration): void {
  if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
}

async function probeServiceWorkerScriptReachable(swUrl: string): Promise<boolean> {
  try {
    const res = await fetch(swUrl, { cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

function waitForServiceWorkerActivation(
  reg: ServiceWorkerRegistration,
  timeoutMs: number,
): Promise<ServiceWorkerRegistration | null> {
  if (reg.active) return Promise.resolve(reg)

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: ServiceWorkerRegistration | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve(result)
    }
    const timer = window.setTimeout(() => finish(reg.active ? reg : null), timeoutMs)

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker) return
      const onState = () => {
        if (reg.active || worker.state === 'activated') finish(reg)
      }
      worker.addEventListener('statechange', onState)
      onState()
    }

    reg.addEventListener('updatefound', () => {
      watchWorker(reg.installing)
    })

    kickWaitingServiceWorker(reg)
    watchWorker(reg.installing ?? reg.waiting)
    if (!reg.installing && !reg.waiting) finish(null)
  })
}

function buildServiceWorkerHint(params: {
  state: ServiceWorkerConnectionState
  swScriptReachable: boolean | null
  registerError: string | null
  pageControlled: boolean
}): string {
  if (params.registerError) {
    if (/ssl|certificate|cert|security|failed to fetch/i.test(params.registerError)) {
      return (
        '安卓用本机 IP 访问 dev 时，自签 HTTPS 证书常导致 SW 安装失败（iOS 往往更宽松）。' +
        '建议安卓改用 GitHub Pages 正式地址测试，或在 Edge 直接打开 sw.js 看能否加载'
      )
    }
    return `注册失败：${params.registerError}`
  }
  if (params.swScriptReachable === false) {
    return `无法加载 ${resolveServiceWorkerScriptUrl()}（404 或证书错误）。iOS 能连而安卓不能时，常见是安卓用了局域网 IP + 自签证书`
  }
  if (params.state === 'active' && !params.pageControlled) {
    return 'SW 已安装，但当前页尚未被接管（浏览器规则：安装后必须刷新本页一次）'
  }
  return describeServiceWorkerConnectionHint(params.state)
}

function resolveServiceWorkerConnectionState(
  reg: ServiceWorkerRegistration | null,
): ServiceWorkerConnectionState {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported'
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure'
  if (!reg) return 'none'
  if (reg.active) return 'active'
  if (reg.installing) return 'installing'
  if (reg.waiting) return 'waiting'
  return 'none'
}

function describeServiceWorkerConnectionHint(state: ServiceWorkerConnectionState): string {
  switch (state) {
    case 'unsupported':
      return '当前浏览器不支持 Service Worker'
    case 'insecure':
      return '需要 https:// 才能注册 Service Worker（安卓后台通知依赖它）'
    case 'active':
      return '已连接，安卓切后台可弹系统通知'
    case 'installing':
      return '正在安装 Service Worker，请稍候 5–10 秒（安卓较慢），勿反复点重连'
    case 'waiting':
      return 'Service Worker 已下载，请刷新本页一次即可连接'
    case 'none':
    default:
      return '未连接：安卓切后台几乎无法弹系统通知，请先连接 Service Worker'
  }
}

/** 当前环境是否具备 Web Push / 离线推送的基础能力 */
export function isOfflinePushEnvironmentSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (!window.isSecureContext) return false
  if (!('serviceWorker' in navigator)) return false
  if (!('PushManager' in window)) return false
  return true
}

function buildOfflinePushBlockHint(params: {
  webPushOfflineConfigured: boolean
  secureContext: boolean
  permissionGranted: boolean
  enabledLocally: boolean
  pushManagerSupported: boolean
  swActive: boolean
  hasSubscription: boolean
  workerConnected: boolean
}): string | null {
  if (
    params.hasSubscription &&
    params.enabledLocally &&
    params.permissionGranted &&
    params.webPushOfflineConfigured &&
    params.secureContext &&
    params.pushManagerSupported &&
    params.swActive
  ) {
    return null
  }
  if (!params.webPushOfflineConfigured) {
    return '未配置 VITE_WEB_PUSH_API_BASE'
  }
  if (!params.secureContext) {
    return '需要 HTTPS 环境'
  }
  if (!params.permissionGranted) {
    return '请先允许通知权限'
  }
  if (!params.enabledLocally) {
    return '请先打开「后台推送」开关（会向浏览器注册 Web Push 订阅）'
  }
  if (!params.pushManagerSupported) {
    return '当前浏览器不支持 Web Push'
  }
  if (!params.swActive) {
    return 'Service Worker 未激活；Worker 能连上不代表本机 SW 已就绪，请刷新页面'
  }
  if (!params.hasSubscription) {
    if (params.workerConnected) {
      return 'Worker 已连通，但浏览器尚未完成 Web Push 订阅。请关再开「后台推送」；国内常需梯子才能 subscribe 成功'
    }
    return '尚未完成 Web Push 订阅'
  }
  return '离线推送未就绪'
}

export async function getLumiPushDiagnostics(): Promise<LumiPushDiagnostics> {
  const secureContext = typeof window !== 'undefined' && window.isSecureContext
  const serviceWorkerSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  const swScriptUrl =
    typeof window !== 'undefined' ? new URL(resolveServiceWorkerScriptUrl(), window.location.origin).href : ''
  const workerApiUrl = getWebPushApiBase()
  let pageControlled = false
  let reg: ServiceWorkerRegistration | null = null
  let swScriptReachable: boolean | null = null
  let swInstalled = false
  let needsPageReload = false

  const workerProbePromise =
    isOfflinePushEnvironmentSupported() && workerApiUrl
      ? probeWebPushWorkerConnection(workerApiUrl)
      : Promise.resolve<{ connected: boolean; hint: string | null } | null>(null)

  if (serviceWorkerSupported && secureContext && swScriptUrl) {
    pageControlled = isPageControlledByServiceWorker()

    const [reachable, existingReg] = await Promise.all([
      probeServiceWorkerScriptReachable(swScriptUrl),
      readExistingServiceWorkerRegistration(),
    ])
    swScriptReachable = reachable
    reg = isRegistrationStale(existingReg) ? null : existingReg

    if (reg && !reg.active && (reg.installing || reg.waiting)) {
      kickWaitingServiceWorker(reg)
      reg = (await waitForServiceWorkerActivation(reg, SW_DIAGNOSTIC_WAIT_MS)) ?? reg
    }

    swInstalled = !!(reg?.active || reg?.waiting || cachedSwRegistration?.active)
    needsPageReload = !!reg?.active && !pageControlled
    if (needsPageReload) {
      void ensureServiceWorkerPageControl({ autoReload: shouldAutoReloadForServiceWorkerControl() })
    }
  }
  const swState = resolveServiceWorkerConnectionState(reg)
  const swHint = buildServiceWorkerHint({
    state: swState,
    swScriptReachable,
    registerError: lastServiceWorkerRegisterError,
    pageControlled,
  })
  const registrationActive = pageControlled
  const devAndroidBypass = isDevAndroidLocalNotifyMode()
  const webPushOfflineConfigured = isWebPushOfflineConfigured()
  const permissionGranted = isOsNotificationPermissionGranted()
  const enabledLocally = isBackgroundPushEnabledLocally()
  const pushManagerSupported = typeof window !== 'undefined' && 'PushManager' in window
  const swActive = !!reg?.active
  let hasPushSubscription = false
  if (swActive && pushManagerSupported) {
    try {
      hasPushSubscription = !!(await reg!.pushManager.getSubscription())
    } catch {
      hasPushSubscription = false
    }
  }
  const offlinePushOperational =
    webPushOfflineConfigured &&
    secureContext &&
    permissionGranted &&
    enabledLocally &&
    pushManagerSupported &&
    swActive &&
    hasPushSubscription

  const offlinePushEnvironmentSupported = isOfflinePushEnvironmentSupported()
  let workerProbeState: WebPushWorkerProbeState = 'failed'
  let workerProbeHint: string | null = null

  if (!offlinePushEnvironmentSupported) {
    workerProbeState = 'unsupported'
    workerProbeHint = !secureContext
      ? '需要 HTTPS 环境'
      : !serviceWorkerSupported
        ? '浏览器不支持 Service Worker'
        : '浏览器不支持 Web Push（PushManager）'
  } else if (!workerApiUrl) {
    workerProbeState = 'unconfigured'
    workerProbeHint = '未配置 VITE_WEB_PUSH_API_BASE'
  } else {
    const probe = (await workerProbePromise) ?? { connected: false, hint: '探测失败' }
    workerProbeState = probe.connected ? 'connected' : 'failed'
    workerProbeHint = probe.hint
  }

  const offlinePushBlockHint = buildOfflinePushBlockHint({
    webPushOfflineConfigured,
    secureContext,
    permissionGranted,
    enabledLocally,
    pushManagerSupported,
    swActive,
    hasSubscription: hasPushSubscription,
    workerConnected: workerProbeState === 'connected',
  })

  return {
    secureContext,
    serviceWorkerSupported,
    registrationActive,
    pageControlled,
    swInstalled,
    needsPageReload,
    devAndroidBypass,
    swState,
    swHint,
    swScriptUrl,
    swScriptReachable,
    registerError: lastServiceWorkerRegisterError,
    offlinePushOperational,
    webPushOfflineConfigured,
    offlinePushEnvironmentSupported,
    workerApiUrl,
    workerProbeState,
    workerProbeHint,
    offlinePushBlockHint,
  }
}

export function getServiceWorkerRegisterErrorHint(): string {
  if (typeof window === 'undefined') return '当前环境不支持 Service Worker'
  if (!('serviceWorker' in navigator)) {
    return '当前浏览器不支持 Service Worker。请用 Chrome / Edge 系统浏览器打开，不要在微信、QQ 内置浏览器里打开'
  }
  if (!window.isSecureContext) {
    return 'Service Worker 需要 HTTPS 安全连接。安卓请用 https:// 地址访问（开发时用 npm run dev 的 HTTPS 链接，不要用 http://）'
  }
  if (lastServiceWorkerRegisterError) return lastServiceWorkerRegisterError
  return 'Service Worker 注册失败。安卓用本机 IP 访问 dev 时，自签证书常导致失败；请改用 GitHub Pages 地址，或刷新/重连后再试'
}

function shouldRegisterServiceWorker(reg: ServiceWorkerRegistration | null): boolean {
  if (!reg) return true
  // 正在安装/等待激活时绝不能再次 register，否则安卓会永远卡在「未连接」
  if (reg.installing || reg.waiting) return false
  if (reg.active?.scriptURL?.includes('sw.js')) return false
  return true
}

async function resolveCachedSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (cachedSwRegistration?.active) return cachedSwRegistration
  if (!cachedSwRegistrationPromise) {
    cachedSwRegistrationPromise = ensurePushServiceWorker()
      .then((reg) => {
        if (reg?.active) cachedSwRegistration = reg
        return reg
      })
      .catch(() => {
        cachedSwRegistrationPromise = null
        return null
      })
  }
  return cachedSwRegistrationPromise
}

/** 应用启动 / 开启推送时预热 SW，避免切后台后再 await ready 被安卓节流 */
export function warmLumiPushStack(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  void resolveCachedSwRegistration()
  void navigator.serviceWorker.ready.catch(() => {})
}

export async function ensurePushServiceWorker(options?: {
  waitMs?: number
  /** 清除所有旧 registration 后重装（安卓 dev 卡住时用） */
  forceReset?: boolean
}): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  if (typeof window !== 'undefined' && !window.isSecureContext) return null

  const waitMs = options?.waitMs ?? defaultServiceWorkerWaitMs()
  const swUrl = resolveServiceWorkerScriptUrl()
  const scope = resolveServiceWorkerScope()

  try {
    lastServiceWorkerRegisterError = null

    if (options?.forceReset) {
      await clearAllServiceWorkerRegistrations()
      cachedSwRegistration = null
      cachedSwRegistrationPromise = null
    }

    let reg = (await navigator.serviceWorker.getRegistration(scope)) ?? null

    if (reg && isRegistrationStale(reg)) {
      await reg.unregister()
      reg = null
    }

    if (shouldRegisterServiceWorker(reg)) {
      reg = await navigator.serviceWorker.register(swUrl, { scope, updateViaCache: 'none' })
    }

    if (!reg) return null

    kickWaitingServiceWorker(reg)

    const activated = await waitForServiceWorkerActivation(reg, waitMs)
    if (activated?.active) {
      cachedSwRegistration = activated
      return activated
    }

    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), waitMs)),
    ])
    const finalReg = ready ?? reg
    if (finalReg?.active) cachedSwRegistration = finalReg
    return finalReg
  } catch (e) {
    lastServiceWorkerRegisterError = e instanceof Error ? e.message : String(e)
    return null
  }
}

/** 强制清除旧 SW 并重新注册（安卓 dev 推荐） */
export async function reconnectLumiServiceWorker(): Promise<{ ok: boolean; hint: string }> {
  cachedSwRegistration = null
  cachedSwRegistrationPromise = null
  lastServiceWorkerRegisterError = null
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, hint: '当前浏览器不支持 Service Worker' }
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return { ok: false, hint: getServiceWorkerRegisterErrorHint() }
  }

  const swUrl = resolveServiceWorkerScriptUrl()
  const reachable = await probeServiceWorkerScriptReachable(
    new URL(swUrl, window.location.origin).href,
  )
  if (!reachable) {
    return {
      ok: false,
      hint:
        `无法加载 ${swUrl}。若浏览器能打开 sw.js 但此处失败，请刷新页面后重试；` +
        '仍不行请清除 Edge 站点数据后重开',
    }
  }

  await clearAllServiceWorkerRegistrations()
  clearServiceWorkerControlReloadFlag()
  const reg = await ensurePushServiceWorker({ waitMs: 15_000, forceReset: false })
  const diag = await getLumiPushDiagnostics()

  if (diag.pageControlled) {
    return { ok: true, hint: 'Service Worker 已连接，页面已接管' }
  }
  if (diag.needsPageReload || diag.swInstalled) {
    reloadPageForServiceWorkerControl()
    return { ok: true, hint: 'SW 已安装，正在刷新页面以完成接管…' }
  }
  if (reg && (diag.swState === 'installing' || diag.swState === 'waiting')) {
    return { ok: false, hint: `${diag.swHint}。请等待约 10 秒后点刷新页面` }
  }
  return { ok: false, hint: diag.swHint || getServiceWorkerRegisterErrorHint() }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('连接 Push 服务超时')
    }
    throw e
  } finally {
    window.clearTimeout(timer)
  }
}

async function fetchVapidPublicKey(apiBase: string): Promise<string> {
  const res = await fetchWithTimeout(`${apiBase}/vapid-public-key`)
  const data = (await res.json()) as { ok?: boolean; publicKey?: string; message?: string }
  if (!res.ok || !data.publicKey?.trim()) {
    throw new Error(data.message?.trim() || '无法获取 VAPID 公钥')
  }
  return data.publicKey.trim()
}

async function probeWebPushWorkerConnection(apiBase: string): Promise<{
  connected: boolean
  hint: string | null
}> {
  try {
    const res = await fetchWithTimeout(`${apiBase}/health`)
    const data = (await res.json()) as { ok?: boolean; vapidReady?: boolean; message?: string }
    if (!res.ok || !data.ok) {
      return {
        connected: false,
        hint: data.message?.trim() || `Worker 响应异常 (${res.status})`,
      }
    }
    if (data.vapidReady) {
      return { connected: true, hint: null }
    }
    try {
      await fetchVapidPublicKey(apiBase)
      return { connected: true, hint: null }
    } catch (e) {
      return {
        connected: false,
        hint: e instanceof Error ? e.message : 'Worker 已响应但 VAPID 未就绪',
      }
    }
  } catch (e) {
    return {
      connected: false,
      hint: e instanceof Error ? e.message : '无法连接 Worker（国内常需梯子）',
    }
  }
}

export type ConnectWebPushWorkerResult = { ok: true; message?: string } | { ok: false; message: string }

/** 手动探测并连接 Push Worker（/health + VAPID） */
export async function connectWebPushWorker(): Promise<ConnectWebPushWorkerResult> {
  if (!isOfflinePushEnvironmentSupported()) {
    return { ok: false, message: '当前环境不支持 Web Push' }
  }
  const apiBase = getWebPushApiBase()
  if (!apiBase) {
    return { ok: false, message: '未配置 VITE_WEB_PUSH_API_BASE' }
  }
  const probe = await probeWebPushWorkerConnection(apiBase)
  if (probe.connected) {
    return { ok: true, message: 'Push Worker 已连接' }
  }
  return { ok: false, message: probe.hint ?? '无法连接 Push Worker' }
}

async function postJson<T>(apiBase: string, path: string, body: unknown, timeoutMs = 6000): Promise<T> {
  const res = await fetchWithTimeout(
    `${apiBase}${path}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs,
  )
  const data = (await res.json()) as T & { message?: string }
  if (!res.ok) {
    throw new Error((data as { message?: string }).message?.trim() || `请求失败 (${res.status})`)
  }
  return data
}

export type EnableBackgroundPushResult =
  | { ok: true; mode: 'full' | 'local-only'; message?: string }
  | { ok: false; reason: 'unsupported' | 'denied' | 'error'; message: string }

export type SubscribeWebPushResult = { ok: true; message?: string } | { ok: false; message: string }

async function performWebPushSubscription(): Promise<SubscribeWebPushResult> {
  const apiBase = getWebPushApiBase()
  if (!apiBase || !isWebPushOfflineConfigured()) {
    return { ok: false, message: '未配置 VITE_WEB_PUSH_API_BASE' }
  }
  if (!('PushManager' in window)) {
    return { ok: false, message: '当前浏览器不支持 Web Push' }
  }

  const reg = await ensurePushServiceWorker()
  if (!reg?.active) {
    return { ok: false, message: 'Service Worker 未激活，请刷新页面后重试' }
  }

  await navigator.serviceWorker.ready

  const publicKey = await fetchVapidPublicKey(apiBase)
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
  }

  const clientId = getLumiPushClientId()
  if (!clientId) return { ok: false, message: '无法生成本机标识' }

  await postJson(apiBase, '/subscribe', {
    clientId,
    subscription: sub.toJSON(),
    enabled: true,
    provider: getWebPushProvider(),
  })

  return { ok: true, message: 'Web Push 订阅成功' }
}

export { kickstartKeepAliveAudioFromUserGesture, primeBackgroundMediaKeepAliveFromUserGesture } from './backgroundMediaKeepAlive'

/** 在用户点击时发起 Web Push 订阅（需已允许通知权限；国内常需梯子） */
export async function subscribeWebPushFromUserGesture(): Promise<SubscribeWebPushResult> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { ok: false, message: '当前浏览器不支持系统通知' }
  }
  if (!isOsNotificationPermissionGranted()) {
    return { ok: false, message: '请先点「允许通知」并授予权限' }
  }
  if (!isWebPushOfflineConfigured()) {
    return { ok: false, message: '未配置 VITE_WEB_PUSH_API_BASE' }
  }
  try {
    const result = await performWebPushSubscription()
    if (result.ok) {
      return {
        ok: true,
        message: `${result.message ?? 'Web Push 订阅成功'}（国内若仍收不到离线推送，请开梯子）`,
      }
    }
    return result
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `订阅失败：${message}（国内常需梯子）` }
  }
}

/** 后台保活：Web Locks + Media Session + 切后台本地通知（不含 Web Push 订阅） */
export async function enableBackgroundKeepAlive(options?: {
  skipPermissionRequest?: boolean
}): Promise<EnableBackgroundPushResult> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { ok: false, reason: 'unsupported', message: '当前浏览器不支持系统通知' }
  }

  let permission: PushPermissionState = getPushPermissionState()
  if (!options?.skipPermissionRequest) {
    permission = await requestLumiNotificationPermission()
  } else if (!isOsNotificationPermissionGranted()) {
    permission = getPushPermissionState()
  }
  if (permission !== 'granted') {
    return {
      ok: false,
      reason: permission === 'unsupported' ? 'unsupported' : 'denied',
      message: describeNotificationPermissionBlock(permission),
    }
  }

  warmLumiPushStack()
  setBackgroundKeepAliveEnabledLocally(true)
  if (shouldUseAudioForKeepAlive()) {
    setContinuousKeepAliveEnabled(true)
    notifyKeepAliveEnabledFromUserGesture()
    if (!isHtmlKeepAlivePlaying()) {
      kickstartKeepAliveAudioFromUserGesture()
      await syncContinuousKeepAlivePlaybackIfEnabled()
    }
  } else {
    setContinuousKeepAliveEnabled(false)
    stopBackgroundMediaKeepAlive()
  }
  return {
    ok: true,
    mode: 'local-only',
    message: shouldUseAudioForKeepAlive()
      ? '已开启静音循环保活；控制中心会出现「Lumi Phone」播放条'
      : '已开启 Web Locks 保活；切到其他 App 后尽量维持页面进程',
  }
}

/** 后台推送：用户选择切后台时是否用系统通知栏展示新消息；可选连接云端 Web Push 兜底 */
export async function enableBackgroundPush(options?: {
  skipPermissionRequest?: boolean
}): Promise<EnableBackgroundPushResult> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { ok: false, reason: 'unsupported', message: '当前浏览器不支持系统通知' }
  }

  let permission: PushPermissionState = getPushPermissionState()
  if (!options?.skipPermissionRequest) {
    permission = await requestLumiNotificationPermission()
  } else if (!isOsNotificationPermissionGranted()) {
    permission = getPushPermissionState()
  }
  if (permission !== 'granted') {
    return {
      ok: false,
      reason: permission === 'unsupported' ? 'unsupported' : 'denied',
      message: describeNotificationPermissionBlock(permission),
    }
  }

  warmLumiPushStack()
  setBackgroundPushEnabledLocally(true)

  const localMessage = '已开启后台推送；切后台时新消息会弹系统通知'

  if (isWebPushOfflineConfigured() && getWebPushApiBase() && 'PushManager' in window) {
    try {
      const subResult = await performWebPushSubscription()
      if (subResult.ok) {
        return {
          ok: true,
          mode: 'full',
          message: `${localMessage}，云端离线推送已连接`,
        }
      }
      return {
        ok: true,
        mode: 'local-only',
        message: `${localMessage}（云端离线推送未连接：${subResult.message}，可稍后点「订阅离线推送」）`,
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      return {
        ok: true,
        mode: 'local-only',
        message: `${localMessage}（云端离线推送未连接${detail ? `：${detail}` : ''}，可稍后点「订阅离线推送」）`,
      }
    }
  }

  return {
    ok: true,
    mode: 'local-only',
    message: `${localMessage}（可选：下方连接云端离线推送）`,
  }
}

export async function disableBackgroundPush(): Promise<void> {
  const apiBase = getWebPushApiBase()
  const clientId = getLumiPushClientId()
  if (apiBase && clientId) {
    try {
      await postJson(apiBase, '/unsubscribe', { clientId })
    } catch {
      /* ignore */
    }
  }
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      await sub?.unsubscribe()
    } catch {
      /* ignore */
    }
  }
  setBackgroundPushEnabledLocally(false)
}

export type SendTestPushResult =
  | { ok: true; via: 'local' | 'local-pending'; cloudFallback: boolean; hint?: string }
  | { ok: false; message: string }

const TEST_VISIBILITY_LISTEN_MS = 45_000

async function scheduleCloudNotifyFallback(params: {
  jobId: string
  clientId: string
  title: string
  body: string
  delayMs: number
  data?: Record<string, unknown>
}): Promise<boolean> {
  const apiBase = getWebPushApiBase()
  if (!apiBase) return false
  try {
    await postJson(apiBase, '/test/start', {
      jobId: params.jobId,
      clientId: params.clientId,
      delayMs: params.delayMs,
      title: params.title,
      body: params.body,
      data: params.data,
    })
    return true
  } catch {
    return false
  }
}

export async function canUseCloudPushFallback(): Promise<boolean> {
  if (!isWebPushOfflineConfigured()) return false
  if (!isBackgroundPushEnabledLocally()) return false
  if (!isOsNotificationPermissionGranted()) return false
  return !!(await getExistingPushSubscription())
}

export async function scheduleCloudNotifyFallbackJob(params: {
  jobId: string
  title: string
  body: string
  delayMs?: number
  data?: Record<string, unknown>
}): Promise<boolean> {
  const clientId = getLumiPushClientId()
  if (!clientId) return false
  return scheduleCloudNotifyFallback({
    jobId: params.jobId,
    clientId,
    title: params.title,
    body: params.body,
    delayMs: params.delayMs ?? 8000,
    data: params.data,
  })
}

export async function cancelCloudNotifyFallback(jobId: string): Promise<void> {
  const apiBase = getWebPushApiBase()
  if (!apiBase || !jobId.trim()) return
  try {
    await postJson(apiBase, '/test/cancel', { jobId: jobId.trim() })
  } catch {
    /* ignore */
  }
}

function tryShowLocalSystemNotification(title: string, body: string): Promise<boolean> {
  if (isLumiPageVisibleToUser()) return Promise.resolve(false)
  return showLumiOsNotification({ title, body, tag: 'lumi-test' })
}

/**
 * 测试系统通知：页面切到后台后只弹一条本地 Notification（不登记云端兜底，避免重复）。
 */
export async function sendTestSystemNotification(): Promise<SendTestPushResult> {
  const title = 'Lumi Phone'
  const body = '测试系统通知：若你已切到其他 App 或桌面，应在通知栏看到本条消息。'

  if (typeof Notification === 'undefined') {
    return { ok: false, message: '当前浏览器不支持系统通知' }
  }
  if (!isBackgroundPushEnabledLocally()) {
    return { ok: false, message: '请先在上方打开「后台推送」开关' }
  }
  if (!isOsNotificationPermissionGranted()) {
    return {
      ok: false,
      message:
        '此网站的通知权限未允许。请在 Edge 地址栏 🔒 → 网站权限 → 通知 → 允许（与安卓系统里 Edge 的通知开关是两层，需都打开）',
    }
  }

  let localDelivered = false
  let localDelivering = false
  let listenersCleaned = false
  let cleanupListeners = () => {}

  const deliverLocal = async (): Promise<boolean> => {
    if (localDelivered) return true
    if (localDelivering) return false
    localDelivering = true
    try {
      const shown = await tryShowLocalSystemNotification(title, body)
      if (shown) {
        localDelivered = true
        cleanupListeners()
      }
      return shown
    } finally {
      localDelivering = false
    }
  }

  if (document.visibilityState === 'hidden') {
    const shown = await deliverLocal()
    if (shown) {
      return { ok: true, via: 'local', cloudFallback: false, hint: '已通过本地推送发送测试通知' }
    }
    return {
      ok: true,
      via: 'local-pending',
      cloudFallback: false,
      hint: '当前无法弹出本地通知',
    }
  }

  const onBackground = () => {
    if (document.visibilityState !== 'hidden') return
    void deliverLocal()
  }
  document.addEventListener('visibilitychange', onBackground)
  cleanupListeners = () => {
    if (listenersCleaned) return
    listenersCleaned = true
    document.removeEventListener('visibilitychange', onBackground)
  }
  window.setTimeout(() => {
    cleanupListeners()
  }, TEST_VISIBILITY_LISTEN_MS)

  return {
    ok: true,
    via: 'local-pending',
    cloudFallback: false,
    hint: '请切到其他 App 或桌面，将弹出一条测试通知',
  }
}

/** 页面是否对用户可见（visible = 在项目内，不弹 OS 通知） */
export function isLumiPageVisibleToUser(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

function resolveNotifyIconUrl(): string {
  if (typeof window === 'undefined') return 'image/主屏幕图标.png'
  const base = import.meta.env.BASE_URL || '/'
  const path = `${base}image/主屏幕图标.png`.replace(/([^:]\/)\/+/g, '$1')
  return new URL(path, window.location.origin).href
}

/**
 * 弹出 OS 级系统通知。
 * 安卓切后台后：优先页面侧 reg.showNotification（比 postMessage / new Notification 更可靠）。
 */
export async function showLumiOsNotification(params: {
  title: string
  body: string
  tag?: string
  /** 通知栏左侧图标；缺省为 App 主屏幕图标 */
  icon?: string
  data?: Record<string, unknown>
}): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (!isOsNotificationPermissionGranted()) return false

  const title = params.title.trim() || 'Lumi Phone'
  const body = params.body.trim() || '新消息'
  const tag = params.tag?.trim() || 'lumi-os-notify'
  const fallbackIcon = resolveNotifyIconUrl()
  const icon = supportsPerNotificationCustomIcon()
    ? await resolveOsNotificationIconUrl(params.icon, fallbackIcon)
    : fallbackIcon
  const options = {
    body,
    icon,
    badge: fallbackIcon,
    tag,
    data: params.data ?? {},
    renotify: true,
    vibrate: [200, 100, 200],
  } as NotificationOptions & { renotify?: boolean; image?: string }
  const optionsWithImage = { ...options, image: icon }

  const tryDirectNotification = (): boolean => {
    try {
      new Notification(title, optionsWithImage)
      return true
    } catch {
      return false
    }
  }

  // dev 安卓：SW 接管常失败，切后台时优先直接 Notification
  if (
    isDevAndroidLocalNotifyMode() &&
    typeof document !== 'undefined' &&
    document.visibilityState === 'hidden'
  ) {
    if (tryDirectNotification()) return true
  }

  if ('serviceWorker' in navigator) {
    try {
      let reg =
        cachedSwRegistration?.active ? cachedSwRegistration : (await readExistingServiceWorkerRegistration())
      if (!reg?.active) {
        reg =
          (await Promise.race([
            resolveCachedSwRegistration(),
            new Promise<null>((resolve) => window.setTimeout(() => resolve(null), isLikelyAndroidBrowser() ? 3500 : 1500)),
          ])) ?? reg
      }
      if (reg) {
        await reg.showNotification(title, optionsWithImage)
        return true
      }
    } catch {
      /* fallback */
    }

    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 800)),
      ])
      if (reg?.active) {
        reg.active.postMessage({
          type: 'lumi-show-notification',
          title,
          body,
          tag,
          icon,
          data: params.data ?? {},
        })
        return true
      }
    } catch {
      /* fallback */
    }
  }

  try {
    return tryDirectNotification()
  } catch {
    return false
  }
}

export function installLumiPageVisibilityTracking(): () => void {
  if (typeof document === 'undefined') return () => {}
  const handler = () => {
    /* 供 wechatSystemNotify 等读取 document.visibilityState */
  }
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}
