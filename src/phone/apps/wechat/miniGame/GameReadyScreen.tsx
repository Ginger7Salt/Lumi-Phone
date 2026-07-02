import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import { Pressable } from '../../../components/Pressable'
import { phoneNumStyle } from '../../../types'
import { resolveCharacterAvatarUrl } from '../../../utils/characterAvatarUrl'
import { getGameLabel } from './gameCatalog'
import type { MiniGameType } from './types'

function ReadyAvatar({
  url,
  label,
  name,
  ready,
}: {
  url?: string
  label: string
  name: string
  ready: boolean
}) {
  const resolved = resolveCharacterAvatarUrl({ avatarUrl: url }) || undefined
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div
          className={`h-[72px] w-[72px] overflow-hidden rounded-full border-2 bg-white shadow-sm ${
            ready ? 'border-emerald-400/80' : 'border-[#E5E7EB]'
          }`}
        >
          {resolved ? (
            <img src={resolved} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-[18px] text-[#9CA3AF]">
              {label}
            </div>
          )}
        </div>
        {ready ? (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">
            已准备
          </span>
        ) : null}
      </div>
      <p className="max-w-[96px] truncate text-[13px] font-medium text-[#374151]">{name}</p>
      {!ready ? <p className="text-[11px] text-[#9CA3AF]">未准备</p> : null}
    </div>
  )
}

export function GameReadyScreen({
  open,
  gameType,
  charName,
  avatarUrl,
  playerAvatarUrl,
  onClose,
  onStartGame,
}: {
  open: boolean
  gameType: MiniGameType
  charName?: string
  avatarUrl?: string
  playerAvatarUrl?: string
  onClose: () => void
  onStartGame: () => void
}) {
  const [userReady, setUserReady] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    if (!open) {
      setUserReady(false)
      setCountdown(null)
    }
  }, [open])

  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      onStartGame()
      setCountdown(null)
      return
    }
    const t = window.setTimeout(() => setCountdown((c) => (c != null ? c - 1 : null)), 1000)
    return () => window.clearTimeout(t)
  }, [countdown, onStartGame])

  const handleReady = () => {
    if (userReady || countdown != null) return
    setUserReady(true)
    setCountdown(3)
  }

  const gameLabel = getGameLabel(gameType)
  const peerLabel = charName?.trim() || '对方'

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1400] flex flex-col bg-[#F9FAFB]"
        >
          <div
            className="flex shrink-0 items-center justify-between px-3 pb-2"
            style={{ paddingTop: 'max(52px, calc(env(safe-area-inset-top, 0px) + 44px))' }}
          >
            <Pressable
              className="flex items-center gap-1 rounded-full px-2 py-1.5 text-[#374151] active:bg-black/5"
              onClick={onClose}
            >
              <ChevronLeft size={18} strokeWidth={1.5} />
              <span className="text-[13px]">返回</span>
            </Pressable>
            <div
              className="text-[12px] tracking-[0.14em] text-[#6B7280]"
              style={{ fontFamily: 'var(--phone-font, "Noto Serif SC", serif)' }}
            >
              {gameLabel}
            </div>
            <div className="w-[52px]" />
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
            <p className="mb-1 text-[11px] tracking-[0.16em] text-[#9CA3AF]">对局准备</p>
            <h2
              className="mb-10 text-[22px] font-medium tracking-tight text-[#0A0A0C]"
              style={{ fontFamily: 'var(--phone-font, "Noto Serif SC", serif)' }}
            >
              {gameLabel}
            </h2>

            <div className="flex w-full max-w-[320px] items-start justify-center gap-8">
              <ReadyAvatar url={playerAvatarUrl} label="我" name="你" ready={userReady} />
              <div className="mt-8 text-[13px] font-medium tracking-widest text-[#D1D5DB]">VS</div>
              <ReadyAvatar url={avatarUrl} label={peerLabel.slice(0, 1)} name={peerLabel} ready />
            </div>

            <p className="mt-10 text-center text-[13px] text-[#6B7280]">
              {peerLabel} 已接受邀请，等待你准备
            </p>

            <Pressable
              className={`mt-8 flex h-12 w-full max-w-[280px] items-center justify-center rounded-2xl text-[15px] font-medium transition-opacity ${
                userReady || countdown != null
                  ? 'cursor-default bg-[#E5E7EB] text-[#9CA3AF]'
                  : 'bg-[#0A0A0C] text-white active:opacity-90'
              }`}
              onClick={handleReady}
            >
              {userReady ? '已准备' : '准备'}
            </Pressable>
          </div>

          <AnimatePresence>
            {countdown != null && countdown > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[2px]"
              >
                <motion.span
                  key={countdown}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.2, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                  className="text-[88px] font-semibold tabular-nums text-white drop-shadow-lg"
                  style={phoneNumStyle}
                >
                  {countdown}
                </motion.span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
