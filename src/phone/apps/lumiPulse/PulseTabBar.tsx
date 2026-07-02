import { Home, Compass, MessageCircle, UserRound } from 'lucide-react'
import { motion } from 'framer-motion'

import { Pressable } from '../../components/Pressable'
import { PULSE_COLORS, PULSE_TAB_SPRING } from './constants'
import type { PulseTab } from './pulseTypes'

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

export function PulseTabBar({
  active,
  onChange,
  inboxUnread,
}: {
  active: PulseTab
  onChange: (tab: PulseTab) => void
  inboxUnread?: boolean
}) {
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
                {id === 'inbox' && inboxUnread ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: PULSE_COLORS.dustyRose }}
                  />
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
