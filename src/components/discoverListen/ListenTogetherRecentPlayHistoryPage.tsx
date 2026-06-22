import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, History, Music2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { ListenNum, ListenNumericText } from './ListenNum'
import { listenNumClass } from './listenTogetherTypography'
import {
  formatListenPlayHistoryTime,
  LISTEN_PLAY_HISTORY_CHANGED,
  listListenPlayHistory,
  listenPlayHistoryEntryToSong,
  type ListenPlayHistoryEntry,
} from './listenTogetherPlayHistory'
import type { NeteaseSongItem } from './neteaseMusicApi'

export type ListenTogetherRecentPlayHistoryPageProps = {
  open: boolean
  onBack: () => void
  onPlaySong?: (song: NeteaseSongItem, queue: NeteaseSongItem[], index: number) => void
  className?: string
}

function HistorySongRow({
  entry,
  index,
  onPlay,
}: {
  entry: ListenPlayHistoryEntry
  index: number
  onPlay: () => void
}) {
  const song = listenPlayHistoryEntryToSong(entry)
  return (
    <button
      type="button"
      onClick={onPlay}
      className="flex w-full items-center gap-3 rounded-2xl bg-white/80 px-3 py-2.5 text-left shadow-[0_8px_24px_rgba(120,113,108,0.06)] ring-1 ring-stone-100/80 transition-transform active:scale-[0.99]"
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center text-[12px] text-stone-400 ${listenNumClass}`}>
        <ListenNum>{index}</ListenNum>
      </span>
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-100">
        {song.cover ? (
          <img src={song.cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music2 className="size-5 text-stone-400" strokeWidth={1.5} aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[15px] font-medium text-stone-800">
          <ListenNumericText text={song.name} />
        </p>
        <p className="mt-0.5 line-clamp-1 text-[12px] text-stone-400">
          <ListenNumericText text={song.artist} />
        </p>
        <p className={`mt-1 text-[11px] text-rose-400/90 ${listenNumClass}`}>
          {formatListenPlayHistoryTime(entry.playedAtMs)}
        </p>
      </div>
    </button>
  )
}

export function ListenTogetherRecentPlayHistoryPage({
  open,
  onBack,
  onPlaySong,
  className = '',
}: ListenTogetherRecentPlayHistoryPageProps) {
  const [entries, setEntries] = useState<ListenPlayHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setEntries(await listListenPlayHistory())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void reload()
    const onChanged = () => {
      void reload()
    }
    window.addEventListener(LISTEN_PLAY_HISTORY_CHANGED, onChanged)
    return () => window.removeEventListener(LISTEN_PLAY_HISTORY_CHANGED, onChanged)
  }, [open, reload])

  const handlePlay = (index: number) => {
    const entry = entries[index]
    if (!entry || !onPlaySong) return
    const queue = entries.map(listenPlayHistoryEntryToSong)
    onPlaySong(listenPlayHistoryEntryToSong(entry), queue, index)
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal
          aria-label="最近播放"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className={`fixed inset-0 z-[110] mx-auto flex max-w-[560px] flex-col bg-stone-50 ${className}`}
        >
          <header className="shrink-0 border-b border-stone-100/80 bg-stone-50/95 px-4 pb-4 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="返回"
                onClick={onBack}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-white"
              >
                <ArrowLeft className="size-5" strokeWidth={1.5} />
              </button>
              <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-stone-800">最近播放</h1>
              {entries.length > 0 ? (
                <span className={`shrink-0 text-[13px] text-stone-400 ${listenNumClass}`}>
                  共 <ListenNum>{entries.length.toLocaleString()}</ListenNum> 首
                </span>
              ) : null}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {loading && entries.length === 0 ? (
              <p className="py-20 text-center text-[13px] text-stone-400">加载中…</p>
            ) : null}

            {!loading && entries.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                  <History className="size-6" strokeWidth={1.5} aria-hidden />
                </div>
                <p className="mt-4 text-[15px] font-medium text-stone-700">暂无播放记录</p>
                <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-stone-400">
                  在听一听播放过的歌曲会出现在这里，并显示最近一次播放时间
                </p>
              </div>
            ) : null}

            {entries.length > 0 ? (
              <ul className="space-y-2">
                {entries.map((entry, index) => (
                  <li key={entry.songId}>
                    <HistorySongRow
                      entry={entry}
                      index={index + 1}
                      onPlay={() => handlePlay(index)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
