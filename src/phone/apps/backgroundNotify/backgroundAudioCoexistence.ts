import { useMusicStore } from '../../../stores/useMusicStore'

const KEEPALIVE_AUDIO_MARK = 'lumi-keepalive'

type CoexistenceListener = () => void

const listeners = new Set<CoexistenceListener>()
let installed = false
let unsubscribeMusic: (() => void) | null = null

function isKeepAliveAudioElement(el: HTMLAudioElement): boolean {
  return el.dataset.lumiKeepalive === KEEPALIVE_AUDIO_MARK
}

export { isKeepAliveAudioElement, KEEPALIVE_AUDIO_MARK }

/** 页面上是否有除保活以外的音频正在播放 */
export function isOtherAppAudioElementPlaying(): boolean {
  if (typeof document === 'undefined') return false
  for (const el of document.querySelectorAll('audio')) {
    if (!(el instanceof HTMLAudioElement)) continue
    if (isKeepAliveAudioElement(el)) continue
    if (el.paused || el.ended) continue
    if (el.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) continue
    return true
  }
  return false
}

export function isKeepAliveBlockedByExternalAudio(): boolean {
  if (isOtherAppAudioElementPlaying()) return true
  try {
    return useMusicStore.getState().isPlaying
  } catch {
    return false
  }
}

function notifyCoexistenceChange(): void {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function subscribeKeepAliveAudioCoexistence(listener: CoexistenceListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function onMediaActivity(event: Event): void {
  const target = event.target
  if (target instanceof HTMLAudioElement && isKeepAliveAudioElement(target)) return
  queueMicrotask(() => notifyCoexistenceChange())
}

/** 监听项目内其它 HTMLAudio / 一起听播放，供保活音频让路 */
export function installKeepAliveAudioCoexistence(): () => void {
  if (typeof document === 'undefined' || installed) return () => {}
  installed = true

  document.addEventListener('play', onMediaActivity, true)
  document.addEventListener('pause', onMediaActivity, true)
  document.addEventListener('ended', onMediaActivity, true)

  unsubscribeMusic = useMusicStore.subscribe((state, prev) => {
    if (state.isPlaying !== prev.isPlaying) {
      notifyCoexistenceChange()
    }
  })

  return () => {
    document.removeEventListener('play', onMediaActivity, true)
    document.removeEventListener('pause', onMediaActivity, true)
    document.removeEventListener('ended', onMediaActivity, true)
    unsubscribeMusic?.()
    unsubscribeMusic = null
    installed = false
  }
}

