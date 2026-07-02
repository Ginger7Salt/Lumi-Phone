import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gamepad2, X } from 'lucide-react'

import type { WeChatMiniGameInvitePayload } from '../newFriendsPersona/types'
import {
  canMiniGameInviteHaveMatchResult,
  matchOutcomeTitle,
  playerSideMatchOutcome,
  settlementTitleForPlayer,
} from './miniGameMatchHelpers'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
}

type Props = {
  data: WeChatMiniGameInvitePayload
  peerName?: string
  busy?: boolean
  onAccept: () => void
  onDecline: () => void
  onEnterGame?: () => void
}

/** 角色发来的游戏邀约卡 */
export function MiniGameCharacterInviteReceivedCard({
  data,
  peerName,
  busy = false,
  onAccept,
  onDecline,
  onEnterGame,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(false)
  const responded = data.userResponded
  const finished = !!data.matchResult && canMiniGameInviteHaveMatchResult(data)
  const canEnter = responded === 'accepted' && !finished && !!onEnterGame

  const openPanel = () => {
    if (responded || busy || finished) return
    setPanelOpen(true)
  }

  if (finished) {
    const outcome = playerSideMatchOutcome(data.matchResult)
    const outcomeText = settlementTitleForPlayer(data.matchResult!, peerName)
    const winStyle = outcome === 'win'
    const loseStyle = outcome === 'lose'
    return (
      <motion.div
        className={`w-full overflow-hidden rounded-[16px] shadow-sm ring-1 backdrop-blur-md ${
          winStyle
            ? 'border border-emerald-100/80 bg-white/75 shadow-[0_4px_24px_rgba(16,185,129,0.12)] ring-emerald-100/50'
            : loseStyle
              ? 'border border-stone-200 bg-gray-50/92 opacity-90 ring-stone-100/80'
              : 'border border-amber-100/80 bg-white/75 ring-amber-100/50'
        }`}
        {...CARD_MOTION}
      >
        <div className="flex gap-3 p-3.5">
          <div
            className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[10px] ring-1 ${
              winStyle
                ? 'bg-gradient-to-br from-emerald-50 to-stone-50 ring-emerald-100/60'
                : loseStyle
                  ? 'bg-gradient-to-br from-stone-100 to-stone-50 ring-stone-200/60'
                  : 'bg-gradient-to-br from-amber-50 to-stone-50 ring-amber-100/60'
            }`}
          >
            <Gamepad2
              className={`size-6 stroke-[1.5] ${
                winStyle ? 'text-emerald-600/90' : loseStyle ? 'text-stone-500' : 'text-amber-600/85'
              }`}
            />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[9px] font-semibold tracking-[0.12em] text-stone-400">
              {outcome ? (
                <>
                  <span
                    className={
                      winStyle
                        ? 'text-[10px] text-emerald-600/90'
                        : loseStyle
                          ? 'text-[10px] text-stone-500'
                          : 'text-[10px] text-amber-600/90'
                    }
                  >
                    {matchOutcomeTitle(outcome)}
                  </span>
                  <span className="mx-1 font-normal text-stone-300">·</span>
                  <span className="uppercase tracking-[0.16em]">Result</span>
                </>
              ) : (
                '对局已结束'
              )}
            </p>
            <p className="mt-1 truncate text-[15px] font-medium leading-snug text-[#2D2422]">{data.gameTitle}</p>
            <p
              className={`mt-0.5 truncate text-[12px] ${
                winStyle ? 'text-emerald-700/85' : loseStyle ? 'text-stone-500' : 'text-amber-700/85'
              }`}
            >
              {outcomeText}
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  if (responded === 'accepted') {
    const cardBody = (
      <>
        <div className="flex gap-3 p-3.5">
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-emerald-50 to-stone-50 ring-1 ring-emerald-100/60">
            <Gamepad2 className="size-6 stroke-[1.5] text-emerald-600/90" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[9px] font-semibold tracking-[0.12em] text-emerald-500/85">
              <span className="text-[10px] text-emerald-600/90">已接受</span>
              <span className="mx-1 font-normal text-stone-300">·</span>
              <span className="uppercase tracking-[0.16em]">Ready</span>
            </p>
            <p className="mt-1 truncate text-[15px] font-medium leading-snug text-[#2D2422]">{data.gameTitle}</p>
            {data.replyText?.trim() ? (
              <p className="mt-0.5 line-clamp-2 text-[12px] text-stone-500">{data.replyText.trim()}</p>
            ) : null}
          </div>
        </div>
        <div className="border-t border-emerald-100/50 bg-gradient-to-r from-emerald-50/30 to-white/30 px-3.5 py-2.5">
          <p className="text-[11px] leading-relaxed text-emerald-600/95">
            {canEnter ? '点击进入准备' : '对局随时可以开始'}
          </p>
        </div>
      </>
    )
    if (canEnter) {
      return (
        <motion.button
          type="button"
          className="w-full overflow-hidden rounded-[16px] border border-white/70 bg-white/75 text-left shadow-[0_4px_24px_rgba(16,185,129,0.12)] ring-1 ring-emerald-100/50 backdrop-blur-md active:opacity-90"
          onClick={onEnterGame}
          {...CARD_MOTION}
        >
          {cardBody}
        </motion.button>
      )
    }
    return (
      <motion.div
        className="w-full overflow-hidden rounded-[16px] border border-white/70 bg-white/75 shadow-[0_4px_24px_rgba(16,185,129,0.12)] ring-1 ring-emerald-100/50 backdrop-blur-md"
        {...CARD_MOTION}
      >
        {cardBody}
      </motion.div>
    )
  }

  if (responded === 'declined') {
    return (
      <motion.div
        className="w-full overflow-hidden rounded-[16px] border border-stone-100 bg-gray-50/90 opacity-85 shadow-sm"
        style={{ borderLeftWidth: 2, borderLeftColor: '#9CA3AF' }}
        {...CARD_MOTION}
      >
        <div className="px-3.5 py-3">
          <p className="text-[9px] font-medium tracking-[0.1em] text-stone-400 line-through">
            <span>暂未开局</span>
            <span className="mx-1 font-normal text-stone-300">·</span>
            <span className="uppercase tracking-[0.14em]">Declined</span>
          </p>
          <p className="mt-2 truncate text-[14px] font-medium text-stone-500">{data.gameTitle}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-stone-400">你已拒绝这次邀请</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="w-full overflow-hidden rounded-[16px] border border-white/70 bg-white/75 shadow-[0_4px_24px_rgba(10,10,12,0.08)] ring-1 ring-stone-100/60 backdrop-blur-md"
      {...CARD_MOTION}
    >
      <button
        type="button"
        className="w-full text-left disabled:opacity-60"
        onClick={openPanel}
        disabled={busy}
        aria-expanded={panelOpen}
      >
        <div className="flex gap-3 p-3.5">
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-stone-50 to-stone-100 ring-1 ring-stone-200/60">
            <Gamepad2 className="size-6 stroke-[1.5] text-stone-600/90" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[9px] font-semibold tracking-[0.12em] text-stone-400/90">
              <span className="text-[10px] text-stone-600/95">一起玩游戏</span>
              <span className="mx-1 font-normal text-stone-300">·</span>
              <span className="uppercase tracking-[0.16em]">Mini Game</span>
            </p>
            <p className="mt-1 truncate text-[15px] font-medium leading-snug text-[#2D2422]">{data.gameTitle}</p>
            {data.replyText?.trim() ? (
              <p className="mt-0.5 line-clamp-2 text-[12px] text-stone-500">{data.replyText.trim()}</p>
            ) : (
              <p className="mt-0.5 truncate text-[12px] text-stone-400">等待你的回应</p>
            )}
          </div>
        </div>
        <div className="border-t border-stone-100/60 bg-gradient-to-r from-stone-50/40 to-white/30 px-3.5 py-2.5">
          <p className="text-[11px] leading-relaxed text-stone-500/95">
            {peerName?.trim() ? `${peerName.trim()} 邀请你一起玩` : '邀请你一起玩'}
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
            className="overflow-hidden border-t border-stone-100/60 bg-gradient-to-b from-stone-50/50 to-white/40"
          >
            <div className="flex items-center justify-between px-3.5 pb-1 pt-2.5">
              <p className="text-[11px] font-medium text-stone-600">是否接受邀请？</p>
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
                className="flex-1 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 text-[13px] font-medium text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50"
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
