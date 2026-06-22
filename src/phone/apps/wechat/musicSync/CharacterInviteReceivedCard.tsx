import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Headphones, X } from 'lucide-react'

import type { WeChatMusicSyncInvitePayload } from '../newFriendsPersona/types'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
}

type Props = {
  data: WeChatMusicSyncInvitePayload
  peerName?: string
  busy?: boolean
  onAccept: () => void
  onDecline: () => void
}

/** 角色发来的共听邀约卡：点击后展开接受/拒绝面板，接受后才开始播放 */
export function CharacterInviteReceivedCard({ data, peerName, busy = false, onAccept, onDecline }: Props) {
  const [panelOpen, setPanelOpen] = useState(false)
  const responded = data.userResponded
  const canInteract = !responded && !busy

  const openPanel = () => {
    if (!canInteract) return
    setPanelOpen(true)
  }

  if (responded === 'accepted') {
    return (
      <motion.div
        className="w-[min(260px,calc(100vw-120px))] overflow-hidden rounded-[16px] border border-white/70 bg-white/75 shadow-[0_4px_24px_rgba(255,192,203,0.18)] ring-1 ring-rose-100/50 backdrop-blur-md"
        {...CARD_MOTION}
      >
        <div className="flex gap-3 p-3.5">
          {data.coverUrl ? (
            <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[10px] shadow-[0_2px_10px_rgba(255,192,203,0.25)] ring-1 ring-rose-100/60">
              <img src={data.coverUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-rose-50 via-[#FFF0F3] to-emerald-50/70 ring-1 ring-rose-100/60">
              <Headphones className="size-6 text-emerald-500/90" strokeWidth={1.5} />
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[9px] font-semibold tracking-[0.12em] text-emerald-500/85">
              <span className="text-[10px] text-emerald-600/90">已加入</span>
              <span className="mx-1 font-normal text-stone-300">·</span>
              <span className="uppercase tracking-[0.16em]">Connected</span>
            </p>
            <p className="mt-1 truncate text-[15px] font-medium leading-snug text-[#2D2422]">{data.trackTitle}</p>
            <p className="mt-0.5 truncate text-[12px] text-stone-400">{data.trackArtist || '未知歌手'}</p>
          </div>
        </div>
        <div className="border-t border-rose-100/50 bg-gradient-to-r from-emerald-50/30 via-rose-50/25 to-white/30 px-3.5 py-2.5">
          <p className="text-[11px] leading-relaxed text-stone-500/95">已开始一起听</p>
        </div>
      </motion.div>
    )
  }

  if (responded === 'declined') {
    return (
      <motion.div
        className="w-[min(260px,calc(100vw-120px))] overflow-hidden rounded-[16px] border border-stone-100 bg-gray-50/90 opacity-85 shadow-sm"
        style={{ borderLeftWidth: 2, borderLeftColor: '#9CA3AF' }}
        {...CARD_MOTION}
      >
        <div className="px-3.5 py-3">
          <p className="text-[9px] font-medium tracking-[0.1em] text-stone-400 line-through">
            <span>暂未一起听</span>
            <span className="mx-1 font-normal text-stone-300">·</span>
            <span className="uppercase tracking-[0.14em]">Declined</span>
          </p>
          <p className="mt-2 truncate text-[14px] font-medium text-stone-500">{data.trackTitle}</p>
          <p className="mt-0.5 truncate text-[12px] text-stone-400">{data.trackArtist || '未知歌手'}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-stone-400">你已拒绝这次邀请</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="w-[min(260px,calc(100vw-120px))] overflow-hidden rounded-[16px] border border-white/70 bg-white/75 shadow-[0_4px_24px_rgba(255,192,203,0.22)] ring-1 ring-rose-100/50 backdrop-blur-md"
      {...CARD_MOTION}
    >
      <button
        type="button"
        className="w-full text-left disabled:opacity-60"
        onClick={openPanel}
        disabled={!canInteract}
        aria-expanded={panelOpen}
      >
        <div className="flex gap-3 p-3.5">
          {data.coverUrl ? (
            <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[10px] shadow-[0_2px_10px_rgba(255,192,203,0.25)] ring-1 ring-rose-100/60">
              <img src={data.coverUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="h-[52px] w-[52px] shrink-0 rounded-[10px] bg-gradient-to-br from-rose-50 to-[#FFF0F3] ring-1 ring-rose-100/60" />
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[9px] font-semibold tracking-[0.12em] text-rose-400/90">
              <span className="text-[10px] text-rose-500/95">一起听</span>
              <span className="mx-1 font-normal text-stone-300">·</span>
              <span className="uppercase tracking-[0.16em]">Listen Together</span>
            </p>
            <p className="mt-1 truncate text-[15px] font-medium leading-snug text-[#2D2422]">{data.trackTitle}</p>
            <p className="mt-0.5 truncate text-[12px] text-stone-400">{data.trackArtist || '未知歌手'}</p>
          </div>
        </div>
        <div className="border-t border-rose-100/50 bg-gradient-to-r from-rose-50/40 to-white/30 px-3.5 py-2.5">
          <p className="text-[11px] leading-relaxed text-stone-500/95">
            {peerName?.trim() ? `${peerName.trim()} 邀请你一起听` : '邀请你一起听这首歌'}
            {!panelOpen ? ' · 轻触选择' : ''}
          </p>
        </div>
      </button>

      <AnimatePresence>
        {panelOpen ? (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-rose-100/60 bg-gradient-to-b from-rose-50/50 to-white/40"
          >
            <div className="flex items-center justify-between px-3.5 pb-1 pt-2.5">
              <p className="text-[11px] font-medium text-stone-600">是否加入一起听？</p>
              <button
                type="button"
                className="rounded-full p-1 text-stone-400 hover:bg-stone-100/80 hover:text-stone-600"
                aria-label="收起"
                onClick={() => setPanelOpen(false)}
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="flex gap-2 px-3.5 pb-3.5 pt-1">
              <button
                type="button"
                className="flex-1 rounded-full border border-stone-200/90 bg-white/90 px-3 py-2 text-[13px] font-medium text-stone-600 shadow-sm transition hover:bg-stone-50 disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  setPanelOpen(false)
                  onDecline()
                }}
              >
                拒绝
              </button>
              <button
                type="button"
                className="flex-1 rounded-full bg-gradient-to-r from-rose-400 to-rose-500 px-3 py-2 text-[13px] font-medium text-white shadow-[0_4px_14px_rgba(244,114,182,0.35)] transition hover:from-rose-500 hover:to-rose-600 disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  setPanelOpen(false)
                  onAccept()
                }}
              >
                接受
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
