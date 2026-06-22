import { useEffect, useState } from 'react'

import { useMusicStore, type SyncListeningProfile } from '../../stores/useMusicStore'
import {
  companionSyncDurationKey,
  formatSyncListeningDurationLabel,
  getSyncListeningTotalMinutes,
  hydrateDurationStore,
  LISTEN_TOGETHER_SYNC_DURATION_UPDATED_EVENT,
} from './listenTogetherSyncDuration'

/** 与某角色累计共听时长文案（精确到分钟），无记录时返回 null */
export function useSyncListeningDurationLabel(
  companion: SyncListeningProfile | null | undefined,
): string | null {
  const isPlaying = useMusicStore((s) => s.isPlaying)
  const syncListening = useMusicStore((s) => s.syncListening)

  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!companion) {
      setLabel(null)
      return
    }
    const key = companionSyncDurationKey(companion)
    const update = () => {
      const minutes = getSyncListeningTotalMinutes(companion)
      setLabel(minutes > 0 ? formatSyncListeningDurationLabel(minutes) : null)
    }
    void hydrateDurationStore().then(update)
    const intervalId = window.setInterval(update, 1000)
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail
      if (!detail?.key || detail.key === key) update()
    }
    window.addEventListener(LISTEN_TOGETHER_SYNC_DURATION_UPDATED_EVENT, onUpdated)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener(LISTEN_TOGETHER_SYNC_DURATION_UPDATED_EVENT, onUpdated)
    }
  }, [companion, isPlaying, syncListening])

  return label
}
