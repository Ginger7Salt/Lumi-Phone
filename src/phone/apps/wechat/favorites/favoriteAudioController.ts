type Listener = () => void

let activeAudio: HTMLAudioElement | null = null
let activeId: string | null = null
const listeners = new Set<Listener>()

function notify() {
  for (const fn of listeners) fn()
}

export function subscribeFavoriteAudio(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getFavoriteAudioPlayingId(): string | null {
  return activeId
}

export function stopFavoriteAudio(): void {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.currentTime = 0
    activeAudio = null
  }
  activeId = null
  notify()
}

export function playFavoriteAudio(id: string, url: string): void {
  const fid = id.trim()
  const src = url.trim()
  if (!fid || !src) return

  if (activeId === fid && activeAudio && !activeAudio.paused) {
    stopFavoriteAudio()
    return
  }

  stopFavoriteAudio()

  const audio = new Audio(src)
  activeAudio = audio
  activeId = fid
  notify()

  const cleanup = () => {
    if (activeId === fid) {
      activeAudio = null
      activeId = null
      notify()
    }
  }

  audio.addEventListener('ended', cleanup)
  audio.addEventListener('error', cleanup)
  void audio.play().catch(() => cleanup())
}
