import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, ChevronLeft, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { Pressable } from '../../../components/Pressable'
import { PULSE_COLORS, PULSE_MODAL_SPRING } from '../constants'
import {
  pickStablePulseNetizenAvatarPath,
  resolvePulseAuthorAvatarUrl,
} from '../pulseNetizenAvatar'
import type { PulseDmThread } from '../pulseTypes'
import { PulseDMRoom } from './PulseDMRoom'
import { PulseNumericText } from './PulseNum'
import { PulseWeiboFaceText } from './PulseWeiboFaceText'

export type PulseInboxDmTab = 'following' | 'stranger'

function formatUnreadLabel(count: number): string {
  return count > 99 ? '99+' : String(Math.max(0, Math.floor(count)))
}

function UnreadBadge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={`pointer-events-none flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-[5px] text-[10px] font-bold leading-none text-white ${className}`.trim()}
      style={{ background: '#fa5151', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.95)' }}
      aria-label={`${count} 条未读`}
    >
      <PulseNumericText
        text={formatUnreadLabel(count)}
        className="text-[10px] font-bold leading-none text-white"
      />
    </span>
  )
}

/**
 * 微博广场 · 专属私信列表页（全中文、柔和轻奢）。
 * 分组：关注我的人（isUserFan）| 未关注人私信
 */
export function PulseInboxList({
  threads,
  onBack,
  onGenerate,
  generating = false,
  playerRealName,
  playerWeiboNickname,
  selfAvatarUrl,
  refCharacterNames,
}: {
  threads: readonly PulseDmThread[]
  onBack: () => void
  onGenerate?: () => void
  generating?: boolean
  playerRealName: string
  playerWeiboNickname?: string
  /** 用户微博头像 */
  selfAvatarUrl?: string
  refCharacterNames?: string[]
}) {
  const [tab, setTab] = useState<PulseInboxDmTab>('following')
  const [activeId, setActiveId] = useState<string | null>(null)

  const { followingThreads, strangerThreads, followingUnread, strangerUnread } = useMemo(() => {
    const followingRows: PulseDmThread[] = []
    const strangerRows: PulseDmThread[] = []
    for (const t of threads) {
      // 「关注我的人」= 对方是你的粉丝，不是「你关注的人」
      if (t.isUserFan === true) followingRows.push(t)
      else strangerRows.push(t)
    }
    const byTime = (a: PulseDmThread, b: PulseDmThread) => b.lastAt - a.lastAt
    followingRows.sort(byTime)
    strangerRows.sort(byTime)
    const sumUnread = (rows: PulseDmThread[]) =>
      rows.reduce((sum, t) => sum + Math.max(0, t.unread || 0), 0)
    return {
      followingThreads: followingRows,
      strangerThreads: strangerRows,
      followingUnread: sumUnread(followingRows),
      strangerUnread: sumUnread(strangerRows),
    }
  }, [threads])

  const visible = tab === 'following' ? followingThreads : strangerThreads
  const activeThread = useMemo(
    () => (activeId ? threads.find((t) => t.id === activeId) ?? null : null),
    [activeId, threads],
  )

  // portal 到 body，避免落在带 transform 的 tab 容器内导致 fixed 失效
  return createPortal(
    <>
      <motion.div
        className="fixed inset-0 z-[1180] flex flex-col bg-[#FCFCFD]"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={PULSE_MODAL_SPRING}
      >
        <header
          className="relative flex shrink-0 items-center justify-center px-3 pb-2"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
        >
          <Pressable
            type="button"
            onClick={onBack}
            className="absolute left-2 flex size-10 items-center justify-center text-[#2D2422]"
            aria-label="返回"
          >
            <ChevronLeft className="size-6" strokeWidth={1.5} />
          </Pressable>
          <h1 className="text-[17px] font-semibold tracking-tight text-[#2D2422]">私信</h1>
          {onGenerate ? (
            <Pressable
              type="button"
              onClick={onGenerate}
              disabled={generating}
              className="absolute right-3 flex items-center gap-1 text-[11px] text-neutral-400 disabled:opacity-50"
              aria-label="生成网友私信"
            >
              <Sparkles
                className="size-3.5"
                strokeWidth={1.3}
                style={{ color: PULSE_COLORS.lightGold }}
              />
              {generating ? '生成中' : '生成'}
            </Pressable>
          ) : null}
        </header>

        <div className="flex shrink-0 items-center justify-center gap-10 px-4 pb-3 pt-1">
          {(
            [
              {
                id: 'following' as const,
                label: '关注我的人',
                unread: followingUnread,
              },
              {
                id: 'stranger' as const,
                label: '未关注人私信',
                unread: strangerUnread,
              },
            ] as const
          ).map((item) => {
            const active = tab === item.id
            return (
              <Pressable
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className="relative pb-2"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`text-[14px] transition-colors ${
                      active ? 'font-semibold text-[#1C1C1E]' : 'font-normal text-neutral-400'
                    }`}
                  >
                    {item.label}
                  </span>
                  <UnreadBadge count={item.unread} className="h-[16px] min-w-[16px] text-[9px]" />
                </span>
                {active ? (
                  <motion.span
                    layoutId="pulse-dm-tab-ink"
                    className="absolute inset-x-2 -bottom-0.5 h-[2px] rounded-full"
                    style={{ backgroundColor: PULSE_COLORS.dustyRose }}
                  />
                ) : null}
              </Pressable>
            )
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10">
          {visible.map((t) => {
            const avatarSrc =
              resolvePulseAuthorAvatarUrl(t.fanAvatarUrl) ||
              resolvePulseAuthorAvatarUrl(pickStablePulseNetizenAvatarPath(`dm:${t.fanName}`))
            const showFanBadge = t.isUserFan === true
            const unread = Math.max(0, t.unread || 0)
            return (
              <Pressable
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveId(t.id)
                }}
                className="mb-2.5 flex w-full items-center gap-3 rounded-[18px] bg-white px-3.5 py-3.5 text-left shadow-sm"
              >
                <div className="relative shrink-0">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="size-12 rounded-full object-cover" />
                  ) : (
                    <div className="size-12 rounded-full bg-[#F0EFED]" />
                  )}
                  {unread > 0 ? (
                    <span className="absolute -right-1 -top-1">
                      <UnreadBadge count={unread} className="ring-2 ring-white" />
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="truncate text-[15px] font-medium text-[#3A3432]">
                      {t.fanName}
                    </span>
                    {showFanBadge ? (
                      <span
                        className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#FFF5F7] px-1.5 py-px text-[9px] font-medium text-[#E5989B]"
                        title="粉丝"
                      >
                        <BadgeCheck className="size-2.5" strokeWidth={2} />
                        粉丝
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-[12px] leading-snug text-neutral-400">
                    {t.lastMessage ? (
                      <PulseWeiboFaceText
                        text={t.lastMessage}
                        singleLine
                        className="text-[12px] text-neutral-400"
                      />
                    ) : (
                      '暂无消息'
                    )}
                  </p>
                </div>
              </Pressable>
            )
          })}

          {!visible.length ? (
            <p className="py-20 text-center text-[13px] text-neutral-300">
              {tab === 'following' ? '暂无关注我的人的私信' : '暂无未关注人私信'}
            </p>
          ) : null}
        </div>
      </motion.div>

      <AnimatePresence>
        {activeThread ? (
          <PulseDMRoom
            thread={activeThread}
            onBack={() => setActiveId(null)}
            playerRealName={playerRealName}
            playerWeiboNickname={playerWeiboNickname}
            selfAvatarUrl={selfAvatarUrl}
            refCharacterNames={refCharacterNames}
          />
        ) : null}
      </AnimatePresence>
    </>,
    document.body,
  )
}
