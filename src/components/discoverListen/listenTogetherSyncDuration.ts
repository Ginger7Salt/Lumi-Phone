import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { useMusicStore, type SyncListeningProfile } from '../../stores/useMusicStore'

export const LISTEN_TOGETHER_SYNC_DURATION_KV_KEY = 'listen-together-sync-duration-v1'
export const LISTEN_TOGETHER_SYNC_DURATION_UPDATED_EVENT = 'listen-together-sync-duration-updated'

type DurationStore = Record<string, number>

let hydrated = false
const secondsByKey: Record<string, number> = {}
const pendingSecondsByKey: Record<string, number> = {}

export function companionSyncDurationKey(companion: SyncListeningProfile): string {
  const id = companion.characterId?.trim()
  if (id) return `id:${id}`
  const name = companion.name.trim()
  return name ? `name:${name}` : 'unknown'
}

export async function hydrateDurationStore(): Promise<void> {
  if (hydrated) return
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_SYNC_DURATION_KV_KEY)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as DurationStore)) {
      const sec = Number(value)
      if (key && Number.isFinite(sec) && sec > 0) secondsByKey[key] = Math.floor(sec)
    }
  }
  hydrated = true
}

async function persistDurationStore(): Promise<void> {
  await personaDb.setPhoneKv(LISTEN_TOGETHER_SYNC_DURATION_KV_KEY, { ...secondsByKey })
}

export function notifySyncDurationUpdated(key: string): void {
  window.dispatchEvent(
    new CustomEvent(LISTEN_TOGETHER_SYNC_DURATION_UPDATED_EVENT, { detail: { key } }),
  )
}

export async function addSyncListeningSeconds(key: string, seconds: number): Promise<void> {
  const k = key.trim()
  const add = Math.floor(seconds)
  if (!k || add <= 0) return
  await hydrateDurationStore()
  secondsByKey[k] = (secondsByKey[k] ?? 0) + add
  await persistDurationStore()
  notifySyncDurationUpdated(k)
}

export function addSyncListeningPendingSeconds(key: string, seconds: number): void {
  const k = key.trim()
  const add = Math.floor(seconds)
  if (!k || add <= 0) return
  pendingSecondsByKey[k] = (pendingSecondsByKey[k] ?? 0) + add
}

export async function flushSyncListeningPendingSeconds(key: string): Promise<void> {
  const k = key.trim()
  if (!k) return
  const pending = pendingSecondsByKey[k] ?? 0
  if (pending <= 0) return
  pendingSecondsByKey[k] = 0
  await addSyncListeningSeconds(k, pending)
}

export async function getSyncListeningStoredSeconds(key: string): Promise<number> {
  await hydrateDurationStore()
  return secondsByKey[key.trim()] ?? 0
}

/** 已持久化 + 当前会话未落库秒数 */
export function getSyncListeningTotalSeconds(companion: SyncListeningProfile): number {
  const key = companionSyncDurationKey(companion)
  const stored = secondsByKey[key] ?? 0
  const pending = pendingSecondsByKey[key] ?? 0
  return stored + pending
}

/** 累计分钟（向下取整到分钟） */
export function getSyncListeningTotalMinutes(companion: SyncListeningProfile): number {
  return Math.floor(getSyncListeningTotalSeconds(companion) / 60)
}

export function formatSyncListeningDurationLabel(totalMinutes: number): string {
  if (totalMinutes <= 0) return ''
  if (totalMinutes < 60) return `${totalMinutes} 分钟`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return `${hours} 小时`
  return `${hours} 小时 ${minutes} 分钟`
}

export function mountSyncListeningDurationTracker(): () => void {
  let activeKey: string | null = null
  let lastTickMs = 0

  const stopTick = () => {
    lastTickMs = 0
  }

  const startTick = () => {
    lastTickMs = Date.now()
  }

  const tick = () => {
    const { syncListening, isPlaying } = useMusicStore.getState()
    if (!syncListening || !isPlaying) {
      stopTick()
      return
    }
    const key = companionSyncDurationKey(syncListening.companion)
    if (activeKey !== key) {
      if (activeKey) void flushSyncListeningPendingSeconds(activeKey)
      activeKey = key
      startTick()
      return
    }
    if (!lastTickMs) {
      startTick()
      return
    }
    const now = Date.now()
    const deltaSec = Math.floor((now - lastTickMs) / 1000)
    lastTickMs = now
    if (deltaSec > 0) addSyncListeningPendingSeconds(key, deltaSec)
  }

  void hydrateDurationStore()

  const intervalId = window.setInterval(tick, 1000)
  const flushIntervalId = window.setInterval(() => {
    if (activeKey) void flushSyncListeningPendingSeconds(activeKey)
  }, 30_000)

  const unsub = useMusicStore.subscribe((state, prev) => {
    if (state.syncListening !== prev.syncListening) {
      if (!state.syncListening) {
        if (activeKey) void flushSyncListeningPendingSeconds(activeKey)
        activeKey = null
        stopTick()
      } else {
        activeKey = companionSyncDurationKey(state.syncListening.companion)
        startTick()
      }
    }
    if (state.isPlaying !== prev.isPlaying) {
      if (!state.isPlaying) {
        if (activeKey) void flushSyncListeningPendingSeconds(activeKey)
        stopTick()
      } else if (state.syncListening) {
        activeKey = companionSyncDurationKey(state.syncListening.companion)
        startTick()
      }
    }
  })

  return () => {
    unsub()
    window.clearInterval(intervalId)
    window.clearInterval(flushIntervalId)
    if (activeKey) void flushSyncListeningPendingSeconds(activeKey)
  }
}
