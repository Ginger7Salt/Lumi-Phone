import { AnimatePresence, motion } from 'framer-motion'

import { Pressable } from '../../../components/Pressable'
import { resolveCharacterAvatarUrl } from '../../../utils/characterAvatarUrl'
import { getGameLabel } from './gameCatalog'
import { settlementSubtitle, settlementTitleForPlayer } from './miniGameMatchHelpers'
import type { WeChatMiniGameMatchResult } from '../newFriendsPersona/types'
import type { MiniGameType } from './types'

export function GameResultOverlay({
  open,
  gameType,
  charName,
  charAvatarUrl,
  result,
  reactionText,
  onReturn,
}: {
  open: boolean
  gameType: MiniGameType
  charName?: string
  charAvatarUrl?: string
  result: WeChatMiniGameMatchResult | null
  reactionText?: string | null
  onReturn: () => void
}) {
  const gameLabel = getGameLabel(gameType)
  const title = result ? settlementTitleForPlayer(result, charName) : ''
  const subtitle = result ? settlementSubtitle(result, charName) : ''
  const tone =
    result === 'player_win' ? 'win' : result === 'char_win' ? 'lose' : result === 'draw' ? 'draw' : 'neutral'
  const dialogue = reactionText?.trim() ?? ''
  const peer = charName?.trim() || '对方'
  const avatarResolved = resolveCharacterAvatarUrl({ avatarUrl: charAvatarUrl }) || undefined

  return (
    <AnimatePresence>
      {open && result ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#F9FAFB]/88 px-6 pb-[max(24px,env(safe-area-inset-bottom))] backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={`w-full max-w-[320px] overflow-hidden rounded-[20px] border bg-white/90 shadow-[0_8px_40px_rgba(10,10,12,0.08)] backdrop-blur-md ${
              tone === 'win'
                ? 'border-emerald-100 ring-1 ring-emerald-100/60'
                : tone === 'lose'
                  ? 'border-stone-200 ring-1 ring-stone-100/80'
                  : 'border-amber-100 ring-1 ring-amber-100/60'
            }`}
          >
            <div
              className={`px-5 py-4 ${
                tone === 'win'
                  ? 'bg-gradient-to-r from-emerald-50/80 to-white'
                  : tone === 'lose'
                    ? 'bg-gradient-to-r from-stone-100/70 to-white'
                    : 'bg-gradient-to-r from-amber-50/70 to-white'
              }`}
            >
              <p
                className={`text-[11px] font-medium tracking-[0.14em] ${
                  tone === 'win'
                    ? 'text-emerald-600/85'
                    : tone === 'lose'
                      ? 'text-stone-500'
                      : 'text-amber-600/85'
                }`}
              >
                {gameLabel} · 对局结束
              </p>
              <h2
                className={`mt-2 text-[28px] font-semibold tracking-tight ${
                  tone === 'win'
                    ? 'text-emerald-700'
                    : tone === 'lose'
                      ? 'text-stone-600'
                      : 'text-amber-700'
                }`}
                style={{ fontFamily: 'var(--phone-font, "Noto Serif SC", serif)' }}
              >
                {title}
              </h2>
              <p className="mt-1 text-[13px] text-[#6B7280]">{subtitle}</p>
            </div>

            <div className="border-t border-stone-100/80 px-4 py-4">
              {dialogue ? (
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[#E5E7EB] bg-white shadow-sm">
                    {avatarResolved ? (
                      <img src={avatarResolved} alt="" className="h-full w-full object-cover" draggable={false} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-[11px] text-[#9CA3AF]">
                        {peer.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="mb-1.5 text-[11px] font-medium text-[#9CA3AF]">{peer}</p>
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                      className="rounded-2xl rounded-tl-md border border-white/70 bg-white/90 px-3.5 py-2.5 text-[13px] leading-snug text-[#0A0A0C] shadow-sm ring-1 ring-stone-100/80"
                      style={{ fontFamily: 'var(--phone-font, "Noto Serif SC", serif)' }}
                    >
                      {dialogue}
                    </motion.p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-stone-100/80 px-5 py-4">
              <Pressable
                className="flex h-11 w-full items-center justify-center rounded-2xl bg-[#0A0A0C] text-[15px] font-medium text-white active:opacity-90"
                onClick={onReturn}
              >
                返回聊天
              </Pressable>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
