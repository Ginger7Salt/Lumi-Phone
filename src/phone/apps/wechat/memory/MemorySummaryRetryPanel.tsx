import { Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { personaDb } from '../newFriendsPersona/idb'
import type { MemorySummaryRetryItem } from '../newFriendsPersona/types'
import {
  formatMemorySummaryRetrySubtitle,
  retryMemorySummaryItem,
} from './memorySummaryRetry'
import { memorySummaryRetryKindLabel } from './wechatMemorySummaryResultEvents'

function formatFailedAt(ts: number): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function MemorySummaryRetryPanel() {
  const apiConfig = useCurrentApiConfig('chatCard')
  const [rows, setRows] = useState<MemorySummaryRetryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [batchBusy, setBatchBusy] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const list = await personaDb.listMemorySummaryRetries()
      setRows(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    const onStorage = () => void reload()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [reload])

  const runRetry = useCallback(
    async (item: MemorySummaryRetryItem) => {
      setBusyId(item.id)
      try {
        await retryMemorySummaryItem(item, apiConfig)
        await reload()
      } finally {
        setBusyId(null)
      }
    },
    [apiConfig, reload],
  )

  const runRetryAll = useCallback(async () => {
    if (!rows.length) return
    setBatchBusy(true)
    try {
      for (const item of rows) {
        await retryMemorySummaryItem(item, apiConfig)
      }
      await reload()
    } finally {
      setBatchBusy(false)
    }
  }, [apiConfig, reload, rows])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-gray-400">
        <Loader2 className="mr-2 size-4 animate-spin" />
        加载待补总结…
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="px-4 py-10 text-center text-[13px] text-gray-400">
        目前暂无待总结
      </div>
    )
  }

  return (
    <div className="px-4 pb-8 pt-2">
      <div className="rounded-[24px] bg-white px-4 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <p className="text-[14px] font-semibold text-gray-900">待补总结</p>
        <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
          下列会话在达到总结间隔时未能写入长期记忆。可在此补跑，不会额外消耗计轮。
        </p>
        <button
          type="button"
          disabled={batchBusy || busyId != null}
          onClick={() => void runRetryAll()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 py-3 text-[13px] font-semibold text-white disabled:opacity-45"
        >
          {batchBusy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          全部补跑（{rows.length}）
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {rows.map((item) => {
          const busy = busyId === item.id || batchBusy
          return (
            <li
              key={item.id}
              className="rounded-[20px] bg-white px-4 py-3.5 shadow-[0_6px_24px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-gray-900">{item.displayName}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {memorySummaryRetryKindLabel(item.kind)} · {formatFailedAt(item.failedAt)}
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-gray-500">
                    {formatMemorySummaryRetrySubtitle(item)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runRetry(item)}
                  className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-semibold text-gray-800 disabled:opacity-45"
                >
                  {busy ? '补跑中…' : '补跑'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
