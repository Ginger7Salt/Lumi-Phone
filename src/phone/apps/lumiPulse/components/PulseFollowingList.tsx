import { motion } from 'framer-motion'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

import { Pressable } from '../../../components/Pressable'
import { PULSE_COLORS, PULSE_MODAL_SPRING } from '../constants'
import { resolvePulseAuthorAvatarUrl } from '../pulseNetizenAvatar'
import type { PulseFollowingUser } from '../pulseTypes'
import { PulseNum } from './PulseNum'

/** 关注列表页 — 点击头像进入对方微博主页 */
export function PulseFollowingList({
  ownerName,
  following,
  onBack,
  onOpenUser,
}: {
  ownerName: string
  following: PulseFollowingUser[]
  onBack: () => void
  onOpenUser: (user: PulseFollowingUser) => void
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[1250] flex flex-col bg-[#FCFCFC]"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={PULSE_MODAL_SPRING}
    >
      <header
        className="flex shrink-0 items-center gap-2 bg-white/90 px-3 py-3 shadow-[0_2px_15px_rgba(0,0,0,0.03)] backdrop-blur-xl"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable type="button" onClick={onBack} className="flex size-9 items-center justify-center rounded-full">
          <ArrowLeft className="size-5" strokeWidth={1.3} />
        </Pressable>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-[#1C1C1E]">{ownerName} 的关注</p>
          <p className="text-[11px] text-neutral-400">
            共 <PulseNum>{following.length}</PulseNum> 人
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {following.length ? (
          following.map((user) => {
            const avatarSrc = resolvePulseAuthorAvatarUrl(user.avatarUrl)
            return (
              <Pressable
                key={user.povId}
                type="button"
                onClick={() => onOpenUser(user)}
                className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="size-12 shrink-0 rounded-full object-cover ring-1 ring-black/[0.04]" />
                ) : (
                  <div className="size-12 shrink-0 rounded-full bg-[#F5F5F4]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-[14px] font-medium text-[#1C1C1E]">{user.name}</span>
                    {user.verified ? (
                      <ShieldCheck className="size-3.5 shrink-0" style={{ color: PULSE_COLORS.lightGold }} strokeWidth={1.5} />
                    ) : null}
                  </div>
                  {user.bio?.trim() ? (
                    <p className="mt-0.5 truncate text-[12px] text-neutral-400">{user.bio}</p>
                  ) : (
                    <p className="mt-0.5 text-[12px] text-neutral-300">点击查看 TA 的主页</p>
                  )}
                </div>
              </Pressable>
            )
          })
        ) : (
          <p className="py-20 text-center text-[13px] text-neutral-400">还没有关注任何人</p>
        )}
      </div>
    </motion.div>
  )
}
