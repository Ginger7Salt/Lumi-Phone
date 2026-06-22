import { useEffect } from 'react'

import { hydrateListenTogetherDataCaches } from './listenTogetherPersistence'
import { hydrateNeteaseListenSession } from './neteaseListenSession'
import {
  ensureListenTogetherPlayerEngine,
  restorePlayerSessionFromCache,
} from './listenTogetherPlayerEngine'

/** 在模拟手机顶层挂载一次，初始化全局音频引擎并恢复上次播放曲目 */
export function ListenTogetherPlayerBootstrap() {
  useEffect(() => {
    ensureListenTogetherPlayerEngine()
    void (async () => {
      await hydrateListenTogetherDataCaches()
      await hydrateNeteaseListenSession()
      await restorePlayerSessionFromCache()
    })()
  }, [])
  return null
}
