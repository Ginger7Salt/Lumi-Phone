import { Home, Compass, MessageCircle, UserRound } from 'lucide-react'
import { motion } from 'framer-motion'

import { Pressable } from '../../components/Pressable'
import { PULSE_COLORS, PULSE_TAB_SPRING } from './constants'
import { PulseNumericText } from './components/PulseNum'
import { formatFollowersGainBadge, type PulseTab } from './pulseTypes'

const TABS: {
  id: PulseTab
  label: string
  en: string
  Icon: typeof Home
}[] = [
  { id: 'home', label: '首页', en: 'Home', Icon: Home },
  { id: 'discover', label: '发现', en: 'Discover', Icon: Compass },
  { id: 'inbox', label: '消息', en: 'Inbox', Icon: MessageCircle },
  { id: 'profile', label: '我', en: 'Profile', Icon: UserRound },
]

function formatInboxUnreadLabel(count: number): string {
  return count > 99 ? '99+' : String(count)
}

export function PulseTabBar({
  active,
  onChange,
  inboxUnreadCount = 0,
  profileFollowersGain = 0,
}: {
  active: PulseTab
  onChange: (tab: PulseTab) => void
  /** 消息 Tab 未读总数（互动 + 私信）；>0 显示数字角标 */
  inboxUnreadCount?: number
  /** 「我」Tab：待确认的粉丝增量；>0 显示 +N 角标 */
  profileFollowersGain?: number
}) {
  const unread = Math.max(0, Math.floor(inboxUnreadCount))
  const followersGain = Math.max(0, Math.floor(profileFollowersGain))
  const followersGainLabel = formatFollowersGainBadge(followersGain)
  return (
    <nav
      className="relative shrink-0 bg-white/85 shadow-[0_-2px_20px_rgba(0,0,0,0.03)] backdrop-blur-xl"
      style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="grid grid-cols-4 px-2 pt-2">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <Pressable
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="relative flex flex-col items-center gap-1 py-2"
              aria-current={isActive ? 'page' : undefined}
              {...(id === 'profile'
                ? { 'data-pulse-coach': 'nav-profile' }
                : id === 'discover'
                  ? { 'data-pulse-coach': 'nav-discover' }
                  : id === 'home'
                    ? { 'data-pulse-coach': 'nav-home' }
                    : id === 'inbox'
                      ? { 'data-pulse-coach': 'nav-inbox' }
                      : {})}
            >
              <div className="relative">
                <motion.div
                  animate={{ scale: isActive ? 1.08 : 1 }}
                  transition={PULSE_TAB_SPRING}
                >
                  <Icon
                    className="size-[22px]"
                    strokeWidth={isActive ? 1.6 : 1.25}
                    style={{ color: isActive ? PULSE_COLORS.ink : '#C4C4C4' }}
                  />
                </motion.div>
                {id === 'inbox' && unread > 0 ? (
                  <span
                    className="absolute -right-2.5 -top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white"
                    style={{ background: '#fa5151', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.95)' }}
                    aria-label={`${unread} 条未读`}
                  >
                    <PulseNumericText
                      text={formatInboxUnreadLabel(unread)}
                      className="text-[9px] font-bold leading-none text-white"
                    />
                  </span>
                ) : null}
                {id === 'profile' && followersGainLabel ? (
                  <span
                    className="absolute -right-3.5 -top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white"
                    style={{ background: '#fa5151', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.95)' }}
                    aria-label={`粉丝新增 ${followersGain}`}
                  >
                    <PulseNumericText
                      text={followersGainLabel}
                      className="text-[9px] font-bold leading-none text-white"
                    />
                  </span>
                ) : null}
              </div>
              <span
                className={`text-[10px] tracking-[0.06em] ${
                  isActive ? 'font-semibold text-[#1C1C1E]' : 'text-neutral-400'
                }`}
              >
                {label}
              </span>
              {isActive ? (
                <motion.span
                  layoutId="pulse-tab-dot"
                  className="absolute -bottom-0.5 size-1 rounded-full"
                  style={{ backgroundColor: PULSE_COLORS.dustyRose }}
                />
              ) : null}
            </Pressable>
          )
        })}
      </div>
    </nav>
  )
}
