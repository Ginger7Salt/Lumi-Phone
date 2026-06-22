import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, UserRound } from 'lucide-react'

import type { NeteaseArtistItem } from './neteaseMusicApi'

type Props = {
  open: boolean
  artists: NeteaseArtistItem[]
  loading?: boolean
  onClose: () => void
  onSelect: (artist: NeteaseArtistItem) => void
}

/** 底部抽屉：多歌手歌曲点击歌手时，选择要查看的歌手 */
export function SongArtistPickerDrawer({
  open,
  artists,
  loading = false,
  onClose,
  onSelect,
}: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭"
            className="fixed inset-0 z-[10020] bg-black/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="song-artist-picker-title"
            className="fixed inset-x-0 bottom-0 z-[10021] max-h-[60vh] overflow-hidden rounded-t-[24px] border border-white/60 bg-white/90 shadow-[0_-8px_40px_rgba(45,36,34,0.12)] backdrop-blur-xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-stone-200/80" />
            <div className="border-b border-stone-100/80 px-5 pb-3 pt-4">
              <h2
                id="song-artist-picker-title"
                className="text-center text-[15px] font-medium text-stone-800"
              >
                选择查看的歌手
              </h2>
              <p className="mt-1 text-center text-[12px] text-stone-400">该歌曲有多位歌手</p>
            </div>

            <div className="max-h-[calc(60vh-120px)] overflow-y-auto px-3 py-2">
              {loading ? (
                <p className="py-8 text-center text-[13px] text-stone-400">正在加载歌手…</p>
              ) : artists.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-stone-400">未找到歌手信息</p>
              ) : (
                <ul className="space-y-0.5">
                  {artists.map((artist) => (
                    <li key={artist.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(artist)}
                        className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-rose-50/50 active:bg-rose-50/70"
                      >
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-stone-100">
                          {artist.avatar ? (
                            <img
                              src={artist.avatar}
                              alt=""
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-50 to-stone-100 text-stone-400">
                              <UserRound className="size-5" strokeWidth={1.5} aria-hidden />
                            </div>
                          )}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-[15px] text-[#1A1A1A]">
                          {artist.name}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-stone-300" strokeWidth={1.75} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-stone-100/80 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full border border-stone-200/90 bg-white py-3 text-[14px] font-medium text-stone-600 transition-colors hover:bg-stone-50"
              >
                取消
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
