import { motion } from 'framer-motion'
import { Gamepad2 } from 'lucide-react'

import type { WeChatMiniGameAcceptPayload, WeChatMiniGameDeclinePayload } from '../newFriendsPersona/types'
import {
  charSideMatchOutcome,
  matchOutcomeTitle,
  playerSideMatchOutcome,
} from './miniGameMatchHelpers'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
}

type AcceptCardProps = {
  data: WeChatMiniGameAcceptPayload
  charName?: string
  /** 用户侧发出的接受卡（角色主动邀约）用玩家视角；角色侧接受卡（用户主动邀约）用角色视角 */
  isSelf?: boolean
  onEnterGame?: () => void
}

export function MiniGameAcceptResponseCard({ data, charName, isSelf = false, onEnterGame }: AcceptCardProps) {
  const outcome = isSelf ? playerSideMatchOutcome(data.matchResult) : charSideMatchOutcome(data.matchResult)
  const finished = outcome != null
  const canEnter = !finished && onEnterGame

  const cardClassName = finished
    ? outcome === 'win'
      ? 'w-full overflow-hidden rounded-[16px] border border-emerald-100/80 bg-white/75 shadow-[0_4px_24px_rgba(16,185,129,0.12)] ring-1 ring-emerald-100/50 backdrop-blur-md'
      : outcome === 'lose'
        ? 'w-full overflow-hidden rounded-[16px] border border-stone-200 bg-gray-50/92 opacity-90 shadow-sm ring-1 ring-stone-100/80'
        : 'w-full overflow-hidden rounded-[16px] border border-amber-100/80 bg-white/75 shadow-sm ring-1 ring-amber-100/50 backdrop-blur-md'
    : 'w-full overflow-hidden rounded-[16px] border border-white/70 bg-white/75 shadow-[0_4px_24px_rgba(16,185,129,0.12)] ring-1 ring-emerald-100/50 backdrop-blur-md'

  const peer = charName?.trim() || '对方'
  const statusLine = finished
    ? isSelf
      ? outcome === 'win'
        ? '你赢了'
        : outcome === 'lose'
          ? peer !== '对方'
            ? `输给了 ${peer}`
            : '你输了'
          : '和棋'
      : outcome === 'win'
        ? '赢了'
        : outcome === 'lose'
          ? '输了'
          : '和棋'
    : data.replyText?.trim() || null

  const footerLine = finished
    ? outcome === 'win'
      ? '本局胜利'
      : outcome === 'lose'
        ? '本局落败'
      : '本局和棋'
    : canEnter
      ? '点击进入准备'
      : '对局随时可以开始'

  const cardBody = (
    <>
      <div className="flex gap-3 p-3.5">
        <div
          className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[10px] ring-1 ${
            finished
              ? outcome === 'win'
                ? 'bg-gradient-to-br from-emerald-50 to-stone-50 ring-emerald-100/60'
                : outcome === 'lose'
                  ? 'bg-gradient-to-br from-stone-100 to-stone-50 ring-stone-200/60'
                  : 'bg-gradient-to-br from-amber-50 to-stone-50 ring-amber-100/60'
              : 'bg-gradient-to-br from-emerald-50 to-stone-50 ring-emerald-100/60'
          }`}
        >
          <Gamepad2
            className={`size-6 stroke-[1.5] ${
              finished
                ? outcome === 'win'
                  ? 'text-emerald-600/90'
                  : outcome === 'lose'
                    ? 'text-stone-500'
                    : 'text-amber-600/85'
                : 'text-emerald-600/90'
            }`}
          />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[9px] font-semibold tracking-[0.12em] text-emerald-500/85">
            {finished ? (
              <>
                <span
                  className={
                    outcome === 'win'
                      ? 'text-[10px] text-emerald-600/90'
                      : outcome === 'lose'
                        ? 'text-[10px] text-stone-500'
                        : 'text-[10px] text-amber-600/90'
                  }
                >
                  {matchOutcomeTitle(outcome!)}
                </span>
                <span className="mx-1 font-normal text-stone-300">·</span>
                <span className="uppercase tracking-[0.16em]">Result</span>
              </>
            ) : (
              <>
                <span className="text-[10px] text-emerald-600/90">已接受</span>
                <span className="mx-1 font-normal text-stone-300">·</span>
                <span className="uppercase tracking-[0.16em]">Ready</span>
              </>
            )}
          </p>
          <p className="mt-1 truncate text-[15px] font-medium leading-snug text-[#2D2422]">{data.gameTitle}</p>
          {statusLine ? (
            <p
              className={`mt-0.5 line-clamp-2 text-[12px] ${
                finished
                  ? outcome === 'win'
                    ? 'text-emerald-700/85'
                    : outcome === 'lose'
                      ? 'text-stone-500'
                      : 'text-amber-700/85'
                  : 'text-stone-500'
              }`}
            >
              {statusLine}
            </p>
          ) : null}
        </div>
      </div>
      <div
        className={`border-t px-3.5 py-2.5 ${
          finished
            ? outcome === 'win'
              ? 'border-emerald-100/50 bg-gradient-to-r from-emerald-50/30 to-white/30'
              : outcome === 'lose'
                ? 'border-stone-200/80 bg-stone-50/50'
                : 'border-amber-100/50 bg-gradient-to-r from-amber-50/25 to-white/30'
            : 'border-emerald-100/50 bg-gradient-to-r from-emerald-50/30 to-white/30'
        }`}
      >
        <p
          className={`text-[11px] leading-relaxed ${
            finished
              ? outcome === 'win'
                ? 'font-medium text-emerald-600/95'
                : outcome === 'lose'
                  ? 'text-stone-500'
                  : 'text-amber-700/90'
              : canEnter
                ? 'font-medium text-emerald-600/95'
                : 'text-stone-500/95'
          }`}
        >
          {footerLine}
        </p>
      </div>
    </>
  )

  if (canEnter) {
    return (
      <motion.button
        type="button"
        className={`${cardClassName} block text-left active:opacity-90`}
        onClick={onEnterGame}
        {...CARD_MOTION}
      >
        {cardBody}
      </motion.button>
    )
  }

  return (
    <motion.div className={cardClassName} {...CARD_MOTION}>
      {cardBody}
    </motion.div>
  )
}

export function MiniGameDeclineResponseCard({ data }: { data: WeChatMiniGameDeclinePayload }) {
  return (
    <motion.div
      className="w-full overflow-hidden rounded-[16px] border border-stone-100 bg-gray-50/90 opacity-85 shadow-sm"
      style={{ borderLeftWidth: 2, borderLeftColor: '#9CA3AF' }}
      {...CARD_MOTION}
    >
      <div className="px-3.5 py-3">
        <p className="text-[9px] font-medium tracking-[0.1em] text-stone-400">
          <span>暂未开局</span>
          <span className="mx-1 font-normal text-stone-300">·</span>
          <span className="uppercase tracking-[0.14em]">Declined</span>
        </p>
        <p className="mt-2 truncate text-[14px] font-medium text-stone-500">{data.gameTitle}</p>
        {data.replyText?.trim() ? (
          <p className="mt-1 text-[12px] text-stone-400">{data.replyText.trim()}</p>
        ) : null}
      </div>
    </motion.div>
  )
}
