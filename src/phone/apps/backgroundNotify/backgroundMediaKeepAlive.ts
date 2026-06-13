import { isIOSWebKit } from '../../utils/platform'
import { shouldUseAudioForKeepAlive } from './backgroundKeepAliveStrategy'
import {
  isKeepAliveBlockedByExternalAudio,
  KEEPALIVE_AUDIO_MARK,
  subscribeKeepAliveAudioCoexistence,
} from './backgroundAudioCoexistence'

/** 生成 16-bit mono PCM 全零样本 WAV（数字静音） */
function createSilentWavDataUrl(durationSec: number, sampleRate = 8000): string {
  const numSamples = Math.max(1, Math.floor(durationSec * sampleRate))
  const bitsPerSample = 16
  const numChannels = 1
  const blockAlign = (bitsPerSample / 8) * numChannels
  const byteRate = sampleRate * blockAlign
  const dataSize = numSamples * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return `data:audio/wav;base64,${btoa(binary)}`
}

const SILENT_WAV_DATA_URL = createSilentWavDataUrl(1)
let silentWavObjectUrl: string | null = null

function resolveSilentWavUrl(): string {
  if (typeof window === 'undefined') return SILENT_WAV_DATA_URL
  if (silentWavObjectUrl) return silentWavObjectUrl
  try {
    const base64 = SILENT_WAV_DATA_URL.split(',')[1] ?? ''
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    silentWavObjectUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
    return silentWavObjectUrl
  } catch {
    return SILENT_WAV_DATA_URL
  }
}

const KEEPALIVE_SESSION_TAG = 'lumi-keepalive-session'
const KEEPALIVE_WATCHDOG_MS = 4000

let primed = false
let active = false
let keepAliveRequested = false
let continuousKeepAliveEnabled = false
let yieldedToExternalAudio = false
let silentAudio: HTMLAudioElement | null = null
let keepAliveAudioContext: AudioContext | null = null
let silentBufferSource: AudioBufferSourceNode | null = null
let silentGainNode: GainNode | null = null
let keepAliveWatchdogTimer: number | null = null
let unsubscribeCoexistence: (() => void) | null = null

function resolveKeepAliveArtworkUrl(): string {
  if (typeof window === 'undefined') return 'image/主屏幕图标.png'
  const base = import.meta.env.BASE_URL || '/'
  const path = `${base}image/主屏幕图标.png`.replace(/([^:]\/)\/+/g, '$1')
  return new URL(path, window.location.origin).href
}

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

function canShowKeepAliveNotification(): boolean {
  if (isIOSWebKit()) return false
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

function needsHtmlAudioKeepAlive(): boolean {
  return continuousKeepAliveEnabled && shouldUseAudioForKeepAlive()
}

export function isHtmlKeepAlivePlaying(): boolean {
  return !!silentAudio && !silentAudio.paused && !silentAudio.ended
}

function shouldUseMediaSession(): boolean {
  if (isKeepAliveBlockedByExternalAudio() || !continuousKeepAliveEnabled) return false
  return isHtmlKeepAlivePlaying()
}

function shouldShowKeepAliveNotification(): boolean {
  if (!shouldUseAudioForKeepAlive()) return false
  return canShowKeepAliveNotification() && continuousKeepAliveEnabled && isDocumentHidden()
}

function configureAudioElement(audio: HTMLAudioElement): void {
  audio.loop = true
  audio.preload = 'auto'
  // 安卓 Chrome 对 volume=0 常不激活 Media Session；PCM 全零 + 极低音量仍听不到
  audio.volume = 0.001
  audio.muted = false
  audio.dataset.lumiKeepalive = KEEPALIVE_AUDIO_MARK
  audio.setAttribute('playsinline', 'true')
  audio.setAttribute('webkit-playsinline', 'true')
  if (isIOSWebKit()) {
    audio.setAttribute('x-webkit-airplay', 'deny')
  }
}

function mountAudioInDom(audio: HTMLAudioElement): void {
  if (typeof document === 'undefined') return
  if (audio.isConnected) return
  audio.style.cssText =
    'position:fixed;width:0;height:0;opacity:0;pointer-events:none;overflow:hidden;clip:rect(0,0,0,0)'
  document.body.appendChild(audio)
}

function applyMediaSessionMetadata(force = false): void {
  if (!force && !shouldUseMediaSession()) return
  if (!continuousKeepAliveEnabled || isKeepAliveBlockedByExternalAudio()) return
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Lumi Phone',
      artist: '后台运行中',
      album: '等待微信新消息',
      artwork: [{ src: resolveKeepAliveArtworkUrl(), sizes: '512x512', type: 'image/png' }],
    })
    navigator.mediaSession.playbackState = 'playing'
    try {
      navigator.mediaSession.setPositionState({
        duration: Number.POSITIVE_INFINITY,
        playbackRate: 1,
        position: 0,
      })
    } catch {
      /* 部分浏览器不支持 */
    }
    const resume = () => {
      if (!isKeepAliveBlockedByExternalAudio()) void startSilentPlayback()
    }
    try {
      navigator.mediaSession.setActionHandler('play', resume)
      navigator.mediaSession.setActionHandler('pause', resume)
      navigator.mediaSession.setActionHandler('stop', resume)
    } catch {
      /* 部分浏览器不支持全部 action */
    }
  } catch {
    /* ignore */
  }
}

function clearMediaSession(): void {
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.playbackState = 'none'
    navigator.mediaSession.metadata = null
  } catch {
    /* ignore */
  }
}

function stopSilentWebAudioSource(): void {
  try {
    silentBufferSource?.stop()
  } catch {
    /* ignore */
  }
  silentBufferSource = null
  silentGainNode = null
}

function closeSilentWebAudioContext(): void {
  stopSilentWebAudioSource()
  void keepAliveAudioContext?.close()
  keepAliveAudioContext = null
}

async function ensureSilentWebAudioRunning(): Promise<boolean> {
  try {
    if (!keepAliveAudioContext || keepAliveAudioContext.state === 'closed') {
      keepAliveAudioContext = new AudioContext()
    }
    if (keepAliveAudioContext.state === 'suspended') {
      await keepAliveAudioContext.resume()
    }
    if (silentBufferSource) return true

    const sampleRate = keepAliveAudioContext.sampleRate
    const buffer = keepAliveAudioContext.createBuffer(1, sampleRate, sampleRate)
    silentBufferSource = keepAliveAudioContext.createBufferSource()
    silentBufferSource.buffer = buffer
    silentBufferSource.loop = true
    silentGainNode = keepAliveAudioContext.createGain()
    silentGainNode.gain.value = 0
    silentBufferSource.connect(silentGainNode)
    silentGainNode.connect(keepAliveAudioContext.destination)
    silentBufferSource.start()
    return true
  } catch {
    return false
  }
}

function pauseHtmlKeepAliveAudio(): void {
  try {
    silentAudio?.pause()
    if (silentAudio) silentAudio.currentTime = 0
  } catch {
    /* ignore */
  }
}

async function yieldKeepAlivePlaybackToExternalAudio(): Promise<void> {
  yieldedToExternalAudio = true
  pauseHtmlKeepAliveAudio()
  stopSilentWebAudioSource()
  clearMediaSession()
  await hideKeepAliveSessionNotification()
}

function ensureCoexistenceSubscription(): void {
  if (unsubscribeCoexistence) return
  unsubscribeCoexistence = subscribeKeepAliveAudioCoexistence(() => {
    void syncKeepAlivePlaybackWithCoexistence()
  })
}

async function syncKeepAlivePlaybackWithCoexistence(): Promise<void> {
  if (!keepAliveRequested) return
  if (isKeepAliveBlockedByExternalAudio()) {
    await yieldKeepAlivePlaybackToExternalAudio()
    active = true
    return
  }
  yieldedToExternalAudio = false
  if (isHtmlKeepAlivePlaying()) {
    await syncKeepAliveSurfaceIndicators()
    return
  }
  await startSilentPlayback()
}

function clearKeepAliveWatchdog(): void {
  if (keepAliveWatchdogTimer != null) {
    window.clearInterval(keepAliveWatchdogTimer)
    keepAliveWatchdogTimer = null
  }
}

function startKeepAliveWatchdog(): void {
  if (!continuousKeepAliveEnabled) return
  if (keepAliveWatchdogTimer != null) return
  keepAliveWatchdogTimer = window.setInterval(() => {
    if (!continuousKeepAliveEnabled || !keepAliveRequested) return
    if (isKeepAliveBlockedByExternalAudio()) return
    if (!isHtmlKeepAlivePlaying()) {
      void startSilentPlayback()
    } else {
      applyMediaSessionMetadata()
    }
  }, KEEPALIVE_WATCHDOG_MS)
}

function ensureSilentAudio(): HTMLAudioElement {
  const src = resolveSilentWavUrl()
  if (!silentAudio) {
    silentAudio = new Audio()
    configureAudioElement(silentAudio)
    silentAudio.src = src
    silentAudio.load()
    mountAudioInDom(silentAudio)
  } else if (!silentAudio.src || silentAudio.src !== src) {
    silentAudio.src = src
    silentAudio.load()
    configureAudioElement(silentAudio)
  }
  return silentAudio
}

function attachHtmlPlayHandlers(playPromise: Promise<void> | undefined): void {
  const done = () => {
    active = true
    primed = true
    applyMediaSessionMetadata(true)
    void ensureSilentWebAudioRunning()
    void syncKeepAliveSurfaceIndicators()
  }
  if (playPromise) {
    playPromise.then(done).catch(() => {
      void startSilentPlayback()
    })
  } else {
    done()
  }
}

async function startHtmlKeepAliveAudio(): Promise<boolean> {
  const audio = ensureSilentAudio()
  mountAudioInDom(audio)
  if (isHtmlKeepAlivePlaying()) return true
  try {
    attachHtmlPlayHandlers(audio.play())
    return true
  } catch {
    try {
      audio.load()
      attachHtmlPlayHandlers(audio.play())
      return true
    } catch {
      return false
    }
  }
}

async function syncKeepAliveSurfaceIndicators(): Promise<void> {
  if (isKeepAliveBlockedByExternalAudio()) {
    clearMediaSession()
  } else if (isHtmlKeepAlivePlaying()) {
    applyMediaSessionMetadata(false)
  } else if (continuousKeepAliveEnabled) {
    applyMediaSessionMetadata(true)
  } else {
    clearMediaSession()
  }
  if (shouldShowKeepAliveNotification()) {
    await showKeepAliveSessionNotification()
  } else {
    await hideKeepAliveSessionNotification()
  }
}

async function startSilentPlayback(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!shouldUseAudioForKeepAlive()) return false
  ensureCoexistenceSubscription()
  keepAliveRequested = true

  if (isKeepAliveBlockedByExternalAudio()) {
    await yieldKeepAlivePlaybackToExternalAudio()
    active = true
    return true
  }

  yieldedToExternalAudio = false

  let htmlOk = isHtmlKeepAlivePlaying()
  if (needsHtmlAudioKeepAlive() && !htmlOk) {
    htmlOk = await startHtmlKeepAliveAudio()
  }

  const webOk = await ensureSilentWebAudioRunning()

  active = htmlOk || webOk || isHtmlKeepAlivePlaying() || primed
  await syncKeepAliveSurfaceIndicators()
  return active
}

/**
 * 在用户点击的同步调用栈里立刻 audio.play()（安卓必需）。
 * 返回是否已成功发起 play()。
 */
export function kickstartKeepAliveAudioFromUserGesture(): boolean {
  if (typeof window === 'undefined') return false
  if (!shouldUseAudioForKeepAlive()) return false
  if (isKeepAliveBlockedByExternalAudio()) {
    primed = true
    return false
  }

  ensureCoexistenceSubscription()
  keepAliveRequested = true
  continuousKeepAliveEnabled = true
  startKeepAliveWatchdog()

  const audio = ensureSilentAudio()
  mountAudioInDom(audio)

  if (isHtmlKeepAlivePlaying()) {
    active = true
    primed = true
    applyMediaSessionMetadata(true)
    void syncKeepAliveSurfaceIndicators()
    return true
  }

  applyMediaSessionMetadata(true)
  try {
    attachHtmlPlayHandlers(audio.play())
    return true
  } catch {
    return false
  }
}

async function postKeepAliveStatusNotification(): Promise<void> {
  const title = 'Lumi Phone'
  const body = '后台运行中 · 等待微信新消息'
  const icon = resolveKeepAliveArtworkUrl()
  const options: NotificationOptions = {
    body,
    icon,
    badge: icon,
    tag: KEEPALIVE_SESSION_TAG,
    silent: true,
    data: { type: 'keepalive-session' },
  }

  if ('serviceWorker' in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2500)),
      ])
      if (reg) {
        await reg.showNotification(title, options)
        return
      }
    } catch {
      /* fallback */
    }

    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 800)),
      ])
      reg?.active?.postMessage({
        type: 'lumi-keepalive-show',
        title,
        body,
        icon,
      })
      return
    } catch {
      /* fallback */
    }
  }

  try {
    new Notification(title, options)
  } catch {
    /* ignore */
  }
}

async function showKeepAliveSessionNotification(): Promise<void> {
  if (!shouldShowKeepAliveNotification() || isKeepAliveBlockedByExternalAudio()) return
  await postKeepAliveStatusNotification()
}

/** 安卓 Web Locks 模式：切后台时的文字常驻通知（非媒体播放条） */
export async function showKeepAliveStatusNotification(): Promise<void> {
  if (shouldUseAudioForKeepAlive()) return
  if (!canShowKeepAliveNotification() || !isDocumentHidden()) return
  await postKeepAliveStatusNotification()
}

export async function hideKeepAliveStatusNotification(): Promise<void> {
  await hideKeepAliveSessionNotification()
}

async function hideKeepAliveSessionNotification(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
      ])
      if (reg) {
        const list = await reg.getNotifications({ tag: KEEPALIVE_SESSION_TAG })
        list.forEach((n) => n.close())
      }
    } catch {
      /* ignore */
    }

    try {
      navigator.serviceWorker.controller?.postMessage({ type: 'lumi-keepalive-hide' })
    } catch {
      /* ignore */
    }
  }
}

export function setContinuousKeepAliveEnabled(enabled: boolean): void {
  if (!shouldUseAudioForKeepAlive()) {
    continuousKeepAliveEnabled = false
    clearKeepAliveWatchdog()
    return
  }
  continuousKeepAliveEnabled = enabled
  if (continuousKeepAliveEnabled) {
    startKeepAliveWatchdog()
  } else {
    clearKeepAliveWatchdog()
  }
}

/** @deprecated 使用 setContinuousKeepAliveEnabled */
export function setIosContinuousKeepAliveEnabled(enabled: boolean): void {
  setContinuousKeepAliveEnabled(enabled)
}

export async function syncContinuousKeepAlivePlaybackIfEnabled(): Promise<void> {
  if (!continuousKeepAliveEnabled || !shouldUseAudioForKeepAlive()) return
  await startSilentPlayback()
}

/** @deprecated 使用 syncContinuousKeepAlivePlaybackIfEnabled */
export async function syncIosKeepAlivePlaybackIfEnabled(): Promise<void> {
  await syncContinuousKeepAlivePlaybackIfEnabled()
}

export async function onKeepAliveReturnedToForeground(): Promise<void> {
  if (!continuousKeepAliveEnabled) return
  await hideKeepAliveSessionNotification()
  if (isHtmlKeepAlivePlaying()) {
    applyMediaSessionMetadata(true)
    return
  }
  await syncContinuousKeepAlivePlaybackIfEnabled()
}

export async function primeBackgroundMediaKeepAliveFromUserGesture(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!shouldUseAudioForKeepAlive()) return
  if (kickstartKeepAliveAudioFromUserGesture()) return
  if (continuousKeepAliveEnabled) {
    const ok = await startSilentPlayback()
    primed = ok
    startKeepAliveWatchdog()
  }
}

export async function startBackgroundMediaKeepAlive(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!shouldUseAudioForKeepAlive()) return
  await startSilentPlayback()
  if (continuousKeepAliveEnabled) {
    startKeepAliveWatchdog()
  }
}

export function stopBackgroundMediaKeepAlive(): void {
  active = false
  primed = false
  keepAliveRequested = false
  continuousKeepAliveEnabled = false
  yieldedToExternalAudio = false
  clearKeepAliveWatchdog()
  clearMediaSession()
  pauseHtmlKeepAliveAudio()
  closeSilentWebAudioContext()
  void hideKeepAliveSessionNotification()
  unsubscribeCoexistence?.()
  unsubscribeCoexistence = null
}

export function isBackgroundMediaKeepAliveActive(): boolean {
  return active || isHtmlKeepAlivePlaying()
}

export function isBackgroundMediaKeepAliveYieldedToExternalAudio(): boolean {
  return yieldedToExternalAudio
}

export function describeKeepAlivePlaybackState(): string {
  if (!continuousKeepAliveEnabled && !keepAliveRequested) return '未开启'
  if (isKeepAliveBlockedByExternalAudio()) return '已让路（其它音频播放中）'
  if (isHtmlKeepAlivePlaying()) return 'HTML 静音播放中'
  if (active) return '保活中（Web Audio）'
  return '未播放（需再点一次开关）'
}
