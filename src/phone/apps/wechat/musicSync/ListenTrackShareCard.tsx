import { motion } from 'framer-motion'

import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { WeChatListenTrackSharePayload } from '../newFriendsPersona/types'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
}

type Props = {
  data: WeChatListenTrackSharePayload
  onOpen?: () => void
}

/** 听一听单曲/歌单分享卡 */
export function ListenTrackShareCard({ data, onOpen }: Props) {
  const isSong = data.targetType === 'song'
  const typeLabel = isSong ? 'Song · 单曲' : 'Playlist · 歌单'
  const subtitle = isSong
    ? data.targetArtist?.trim() || 'Unknown Artist'
    : data.trackCount != null && data.trackCount > 0
      ? `${data.trackCount.toLocaleString()} 首`
      : '歌单'
  const hint = isSong ? '点击收听单曲' : '点击查看歌单'

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen?.()
      }}
      aria-label={hint}
      title={hint}
      className="w-[min(280px,calc(100vw-120px))] overflow-hidden rounded-[16px] border border-white/70 bg-white/80 text-left shadow-[0_4px_28px_rgba(255,192,203,0.24)] ring-1 ring-rose-100/55 backdrop-blur-md transition-transform active:scale-[0.98] hover:ring-rose-200/80"
      {...CARD_MOTION}
    >
      <div className="flex gap-3 p-3.5">
        {data.targetCover ? (
          <div
            className={`h-[56px] w-[56px] shrink-0 overflow-hidden shadow-[0_2px_12px_rgba(255,192,203,0.28)] ring-1 ring-rose-100/60 ${
              isSong ? 'rounded-[12px]' : 'rounded-[12px]'
            }`}
          >
            <img
              src={data.targetCover}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="h-[56px] w-[56px] shrink-0 rounded-[12px] bg-gradient-to-br from-rose-50 to-[#FFF0F3] ring-1 ring-rose-100/60" />
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-rose-400/90">
            {typeLabel}
          </p>
          <p className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-[#2D2422]">
            <ListenNumericText text={data.targetTitle} />
          </p>
          <p className="mt-0.5 truncate text-[12px] text-stone-400">
            <ListenNumericText text={subtitle} />
          </p>
        </div>
      </div>
      {onOpen ? (
        <div className="border-t border-rose-100/55 bg-gradient-to-br from-rose-50/50 via-white/40 to-amber-50/20 px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-rose-400/90">
            {isSong ? '点击收听 →' : '点击查看歌单 →'}
          </p>
        </div>
      ) : null}
    </motion.button>
  )
}
