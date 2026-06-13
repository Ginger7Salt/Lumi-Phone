import {
  cancelCloudNotifyFallback,
  canUseCloudPushFallback,
  isBackgroundKeepAliveEnabledLocally,
  isBackgroundPushEnabledLocally,
  setBackgroundKeepAliveEnabledLocally,
  scheduleCloudNotifyFallbackJob,
} from './backgroundPushClient'
import {
  hasBackgroundNotifyPendingWork,
  subscribeBackgroundNotifyPendingWork,
} from './backgroundNotifyPendingWork'
import { installKeepAliveAudioCoexistence } from './backgroundAudioCoexistence'
import { shouldUseAudioForKeepAlive } from './backgroundKeepAliveStrategy'
import {
  hideKeepAliveStatusNotification,
  onKeepAliveReturnedToForeground,
  primeBackgroundMediaKeepAliveFromUserGesture,
  setContinuousKeepAliveEnabled,
  showKeepAliveStatusNotification,
  startBackgroundMediaKeepAlive,
  stopBackgroundMediaKeepAlive,
} from './backgroundMediaKeepAlive'

import {
  isKeepAliveBootReady,
  isKeepAliveUserGesturePrimed,
  markKeepAliveBootReady,
  markKeepAliveUserGesturePrimed,
  resetKeepAliveBootGate,
} from './keepAliveBootGate'

const KEEPALIVE_LOCK = 'lumi-phone-background-keepalive'
const HEARTBEAT_MS = 20_000
const CLOUD_FALLBACK_DELAY_MS = 28_000

let installed = false
let keepAliveAbort: AbortController | null = null
let heartbeatTimer: number | null = null
let activeCloudJobId: string | null = null
let unsubscribePending: (() => void) | null = null

function createCloudJobId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `cloud-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function markKeepAliveBootReadyFromInstall(): void {
  markKeepAliveBootReady()
}

function canStartKeepAliveRuntimeNow(): boolean {
  if (!isBackgroundKeepAliveEnabledLocally()) return false
  if (!isKeepAliveBootReady()) return false
  return true
}

function primeKeepAliveAudioFromUserGesture(): void {
  if (isKeepAliveUserGesturePrimed()) return
  if (!isBackgroundKeepAliveEnabledLocally() || !shouldUseAudioForKeepAlive()) return
  markKeepAliveUserGesturePrimed()
  void primeBackgroundMediaKeepAliveFromUserGesture()
}

function clearHeartbeat(): void {
  if (heartbeatTimer != null) {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function stopBackgroundKeepAliveRuntime(): void {
  keepAliveAbort?.abort()
  keepAliveAbort = null
  clearHeartbeat()
}

function stopBackgroundKeepAlive(): void {
  stopBackgroundKeepAliveRuntime()
  stopBackgroundMediaKeepAlive()
  void hideKeepAliveStatusNotification()
}

function ensureBackgroundKeepAliveRuntime(): void {
  if (keepAliveAbort) return

  keepAliveAbort = new AbortController()
  const { signal } = keepAliveAbort

  if ('locks' in navigator) {
    void navigator.locks.request(KEEPALIVE_LOCK, { signal }, () => {
      return new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
    })
  }

  clearHeartbeat()
  heartbeatTimer = window.setInterval(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'lumi-keepalive-ping' })
    }
  }, HEARTBEAT_MS)
}

function syncPlatformKeepAliveSurface(): void {
  if (shouldUseAudioForKeepAlive()) {
    if (!isKeepAliveUserGesturePrimed()) return
    void startBackgroundMediaKeepAlive()
    return
  }
  void showKeepAliveStatusNotification()
}

function startBackgroundKeepAlive(): void {
  if (!canStartKeepAliveRuntimeNow()) return

  ensureBackgroundKeepAliveRuntime()
  syncPlatformKeepAliveSurface()
  void syncCloudFallbackSchedule()
}

async function cancelActiveCloudFallback(): Promise<void> {
  const jobId = activeCloudJobId
  activeCloudJobId = null
  if (!jobId) return
  await cancelCloudNotifyFallback(jobId)
}

async function syncCloudFallbackSchedule(): Promise<void> {
  if (!isBackgroundPushEnabledLocally()) return
  if (document.visibilityState === 'visible') return
  if (!hasBackgroundNotifyPendingWork()) {
    await cancelActiveCloudFallback()
    return
  }
  if (!(await canUseCloudPushFallback())) return

  const jobId = activeCloudJobId ?? createCloudJobId()
  activeCloudJobId = jobId
  await scheduleCloudNotifyFallbackJob({
    jobId,
    title: '微信',
    body: '你有新消息',
    delayMs: CLOUD_FALLBACK_DELAY_MS,
    data: { type: 'wechat-fallback' },
  })
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    markKeepAliveBootReadyFromInstall()
  }

  if (document.visibilityState === 'hidden') {
    startBackgroundKeepAlive()
    return
  }
  if (isBackgroundKeepAliveEnabledLocally()) {
    stopBackgroundKeepAliveRuntime()
    if (shouldUseAudioForKeepAlive()) {
      void onKeepAliveReturnedToForeground()
    } else {
      void hideKeepAliveStatusNotification()
    }
    void cancelActiveCloudFallback()
    return
  }
  stopBackgroundKeepAlive()
  void cancelActiveCloudFallback()
}

function onPageHide(event: PageTransitionEvent): void {
  if (event.persisted) return
  if (hasBackgroundNotifyPendingWork()) {
    void syncCloudFallbackSchedule()
  }
}

function onPendingWorkChange(): void {
  if (document.visibilityState === 'hidden') {
    void syncCloudFallbackSchedule()
  }
}

function scheduleKeepAliveBootReady(): void {
  if (typeof window === 'undefined') return
  const mark = () => markKeepAliveBootReadyFromInstall()
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(mark)
  })
  window.setTimeout(mark, 800)
}

export function installBackgroundKeepAlive(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  if (installed) return () => {}
  installed = true

  try {
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)
    unsubscribePending = subscribeBackgroundNotifyPendingWork(onPendingWorkChange)
    const uninstallCoexistence = installKeepAliveAudioCoexistence()

    if (isBackgroundKeepAliveEnabledLocally() && shouldUseAudioForKeepAlive()) {
      setContinuousKeepAliveEnabled(true)
    }

    const onUserGesture = () => {
      markKeepAliveBootReadyFromInstall()
      primeKeepAliveAudioFromUserGesture()
    }
    window.addEventListener('pointerdown', onUserGesture, { capture: true, passive: true })
    window.addEventListener('touchstart', onUserGesture, { capture: true, passive: true })

    if (document.visibilityState === 'visible') {
      scheduleKeepAliveBootReady()
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pointerdown', onUserGesture, { capture: true })
      window.removeEventListener('touchstart', onUserGesture, { capture: true })
      unsubscribePending?.()
      unsubscribePending = null
      uninstallCoexistence()
      stopBackgroundKeepAlive()
      void cancelActiveCloudFallback()
      installed = false
      resetKeepAliveBootGate()
    }
  } catch {
    installed = false
    return () => {}
  }
}

export async function cancelBackgroundCloudFallbackAfterLocalNotify(): Promise<void> {
  await cancelActiveCloudFallback()
}

export function syncBackgroundKeepAliveRuntime(): void {
  if (!isBackgroundKeepAliveEnabledLocally()) {
    stopBackgroundKeepAlive()
    return
  }
  if (shouldUseAudioForKeepAlive()) {
    if (isKeepAliveUserGesturePrimed()) {
      void startBackgroundMediaKeepAlive()
    }
  } else {
    stopBackgroundMediaKeepAlive()
  }
  if (document.visibilityState === 'hidden') {
    startBackgroundKeepAlive()
  } else if (shouldUseAudioForKeepAlive()) {
    void onKeepAliveReturnedToForeground()
  } else {
    void hideKeepAliveStatusNotification()
  }
}

export function disableBackgroundKeepAlive(): void {
  setBackgroundKeepAliveEnabledLocally(false)
  setContinuousKeepAliveEnabled(false)
  resetKeepAliveBootGate()
  stopBackgroundKeepAlive()
}

export { shouldUseAudioForKeepAlive } from './backgroundKeepAliveStrategy'
