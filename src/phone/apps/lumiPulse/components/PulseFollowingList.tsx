import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'

import { Pressable } from '../../../components/Pressable'
import { PULSE_MODAL_SPRING } from '../constants'
import { resolvePulseFollowRelation } from '../pulseFollowRelation'
import type { PulseFollowingUser } from '../pulseTypes'
import { usePulseFollowingList } from '../pulseStoreSelectors'
import { usePulseStore } from '../usePulseStore'
import { PulseFollowButton } from './PulseFollowButton'
import { PulseNum } from './PulseNum'
import { PulseVerifiedAvatar } from './PulseVerifiedAvatar'

/** 关注 / 好友列表页 — 点击条目进入对方微博主页 */
export function PulseFollowingList({
  ownerName,
  following,
  currentPlayerPovId,
  onBack,
  onOpenUser,
  listLabel = '关注',
  emptyText = '还没有关注任何人',
}: {
  ownerName: string
  following: PulseFollowingUser[]
  /** 当前登录微博身份：用于判断「我是否关注 TA / TA 是否关注我」 */
  currentPlayerPovId: string
  onBack: () => void
  onOpenUser: (user: PulseFollowingUser) => void
  /** 标题「{ownerName} 的{listLabel}」 */
  listLabel?: string
  emptyText?: string
}) {
  const myFollowing = usePulseFollowingList(currentPlayerPovId)
  const followingByPov = usePulseStore((s) => {
    const acc = s.currentAccountId
    if (!acc) return null
    return s.root.byAccount[acc]?.followingByPov ?? null
  })
  const toggleFollow = usePulseStore((s) => s.toggleFollow)

  const iFollowSet = useMemo(
    () => new Set(myFollowing.map((u) => u.povId.trim()).filter(Boolean)),
    [myFollowing],
  )

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
          <p className="text-[15px] font-medium text-[#1C1C1E]">
            {ownerName} 的{listLabel}
          </p>
          <p className="text-[11px] text-neutral-400">
            共 <PulseNum>{following.length}</PulseNum> 人
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {following.length ? (
          following.map((user) => {
            const isSelf = user.povId.trim() === currentPlayerPovId.trim()
            const iFollow = iFollowSet.has(user.povId.trim())
            const theyFollow = Boolean(
              followingByPov?.[user.povId]?.some((u) => u.povId.trim() === currentPlayerPovId.trim()),
            )
            const relation = resolvePulseFollowRelation({ iFollow, theyFollow })
            return (
              <Pressable
                key={user.povId}
                type="button"
                onClick={() => onOpenUser(user)}
                className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
              >
                <PulseVerifiedAvatar
                  src={user.avatarUrl}
                  verified={Boolean(user.verified)}
                  sizeClass="size-12"
                  borderClass="ring-1 ring-black/[0.04]"
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[#1C1C1E]">{user.name}</span>
                  {user.bio?.trim() ? (
                    <p className="mt-0.5 truncate text-[12px] text-neutral-400">{user.bio}</p>
                  ) : (
                    <p className="mt-0.5 text-[12px] text-neutral-300">点击查看 TA 的主页</p>
                  )}
                </div>
                {!isSelf ? (
                  <PulseFollowButton
                    compact
                    relation={relation}
                    onClick={() => toggleFollow(user, myFollowing)}
                  />
                ) : null}
              </Pressable>
            )
          })
        ) : (
          <p className="py-20 text-center text-[13px] text-neutral-400">{emptyText}</p>
        )}
      </div>
    </motion.div>
  )
}
