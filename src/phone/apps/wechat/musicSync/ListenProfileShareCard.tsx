import { motion } from 'framer-motion'

import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { WeChatListenProfileSharePayload } from '../newFriendsPersona/types'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
}

type Props = {
  data: WeChatListenProfileSharePayload
  onOpen?: () => void
}

/** 听一听歌手/用户主页分享卡 */
export function ListenProfileShareCard({ data, onOpen }: Props) {
  const typeLabel = data.profileType === 'artist' ? 'Artist · 歌手' : 'User · 用户'
  const subtitle =
    data.subtitle?.trim() ||
    (data.profileType === 'artist' ? '歌手主页' : '网易云用户')
  const hint = data.profileType === 'artist' ? '点击查看歌手主页' : '点击查看用户主页'

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
      <div className="flex items-center gap-3 p-3.5">
        {data.avatar ? (
          <div className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-full shadow-[0_2px_12px_rgba(255,192,203,0.28)] ring-1 ring-rose-100/60">
            <img
              src={data.avatar}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="h-[56px] w-[56px] shrink-0 rounded-full bg-gradient-to-br from-rose-50 to-[#FFF0F3] ring-1 ring-rose-100/60" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-rose-400/90">
            {typeLabel}
          </p>
          <p className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-[#2D2422]">
            <ListenNumericText text={data.displayName} />
          </p>
          <p className="mt-0.5 truncate text-[12px] text-stone-400">
            <ListenNumericText text={subtitle} />
          </p>
        </div>
      </div>
      {onOpen ? (
        <div className="border-t border-rose-100/55 bg-gradient-to-br from-rose-50/50 via-white/40 to-amber-50/20 px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-rose-400/90">点击查看主页 →</p>
        </div>
      ) : null}
    </motion.button>
  )
}
