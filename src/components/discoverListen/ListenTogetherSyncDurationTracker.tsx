import { useEffect } from 'react'

import { mountSyncListeningDurationTracker } from './listenTogetherSyncDuration'
import { mountSyncListeningRecentTracksTracker } from './syncListeningRecentTracks'

/** 全局挂载：共听播放时按角色累计时长 + 切歌后保留近期曲目 */
export function ListenTogetherSyncDurationTracker() {
  useEffect(() => {
    const stopDuration = mountSyncListeningDurationTracker()
    const stopRecent = mountSyncListeningRecentTracksTracker()
    return () => {
      stopDuration()
      stopRecent()
    }
  }, [])
  return null
}
