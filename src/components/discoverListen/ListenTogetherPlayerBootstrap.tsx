import { useEffect } from 'react'

import { useMusicStore } from '../../stores/useMusicStore'
import { hydrateFloatingOrbDismissed } from './listenTogetherFloatingOrbDismiss'
import { hydrateListenTogetherDataCaches } from './listenTogetherPersistence'
import {
  ensureListenTogetherPlayerEngine,
  restorePlayerSessionFromCache,
} from './listenTogetherPlayerEngine'
import { hydrateNeteaseListenSession } from './neteaseListenSession'

/** 在模拟手机顶层挂载一次，初始化全局音频引擎并恢复上次播放曲目 */
export function ListenTogetherPlayerBootstrap() {
  useEffect(() => {
    ensureListenTogetherPlayerEngine()
    void (async () => {
      await hydrateListenTogetherDataCaches()
      await hydrateNeteaseListenSession()
      // 先恢复「用户关闭了悬浮球」标记，再恢复曲目，避免刷新后球又弹出来
      const dismissed = await hydrateFloatingOrbDismissed()
      useMusicStore.getState().hydrateFloatingOrbDismissedFlag(dismissed)
      await restorePlayerSessionFromCache()
    })()
  }, [])
  return null
}
