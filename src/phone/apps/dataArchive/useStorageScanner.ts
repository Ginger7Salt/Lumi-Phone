import { useCallback, useEffect, useRef, useState } from 'react'
import { LUMI_SYS_TOKENS_TOTAL_KEY } from './constants'
import {
  mergeStorageSegments,
  scanLocalStorageSegments,
  type StorageSegment,
} from './scanLocalStorage'
import { scanWeChatPersonaIndexedDbSegments } from './scanWeChatPersonaIndexedDb'

function readTokensTotal(): number {
  if (typeof localStorage === 'undefined') return 0
  const raw = localStorage.getItem(LUMI_SYS_TOKENS_TOTAL_KEY)
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

export function useStorageScanner(pollMs = 8000) {
  const [segmentsIndexedDb, setSegmentsIndexedDb] = useState<StorageSegment[]>([])
  const [segmentsLocalStorage, setSegmentsLocalStorage] = useState<StorageSegment[]>([])
  const [segmentsMerged, setSegmentsMerged] = useState<StorageSegment[]>([])
  const [indexedDbTotalBytes, setIndexedDbTotalBytes] = useState(0)
  const [localStorageTotalBytes, setLocalStorageTotalBytes] = useState(0)
  const [tokensTotal, setTokensTotal] = useState(0)
  const refreshGen = useRef(0)

  const refresh = useCallback(async () => {
    const id = ++refreshGen.current
    const ls = scanLocalStorageSegments()
    let idb = { segments: [] as StorageSegment[], totalBytes: 0 }
    try {
      idb = await scanWeChatPersonaIndexedDbSegments()
    } catch {
      /* IndexedDB 统计失败时环图为空 */
    }
    if (id !== refreshGen.current) return

    setSegmentsIndexedDb(idb.segments)
    setSegmentsLocalStorage(ls.segments)
    setSegmentsMerged(mergeStorageSegments([...ls.segments, ...idb.segments]))
    setIndexedDbTotalBytes(idb.totalBytes)
    setLocalStorageTotalBytes(ls.totalBytes)
    setTokensTotal(readTokensTotal())
  }, [])

  useEffect(() => {
    void refresh()
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea === localStorage) void refresh()
    }
    const onWeChatIdb = () => void refresh()
    const onSysMetrics = () => void refresh()
    window.addEventListener('storage', onStorage)
    window.addEventListener('wechat-storage-changed', onWeChatIdb)
    window.addEventListener('lumi-sys-metrics-changed', onSysMetrics)
    const id = window.setInterval(() => void refresh(), pollMs)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('wechat-storage-changed', onWeChatIdb)
      window.removeEventListener('lumi-sys-metrics-changed', onSysMetrics)
      window.clearInterval(id)
    }
  }, [pollMs, refresh])

  return {
    segmentsIndexedDb,
    segmentsLocalStorage,
    segmentsMerged,
    indexedDbTotalBytes,
    localStorageTotalBytes,
    tokensTotal,
    refresh,
  }
}
