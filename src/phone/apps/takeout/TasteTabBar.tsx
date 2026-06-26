import { Pressable } from '../../components/Pressable'
import type { TasteMainTab } from './types'

const TABS: { id: TasteMainTab; label: string }[] = [
  { id: 'order', label: '点单' },
  { id: 'delivery', label: '送餐' },
  { id: 'messages', label: '消息' },
  { id: 'profile', label: '我的' },
]

function TabIcon({ tab, active }: { tab: TasteMainTab; active: boolean }) {
  const stroke = active ? '#1C1C1E' : '#A3A3A3'
  const sw = active ? 1.45 : 1.25

  if (tab === 'order') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} aria-hidden>
        <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
      </svg>
    )
  }
  if (tab === 'delivery') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} aria-hidden>
        <path d="M3 7h11v8H3z" strokeLinejoin="round" />
        <path d="M14 10h4l3 3v2h-7v-5z" strokeLinejoin="round" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    )
  }
  if (tab === 'messages') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} aria-hidden>
        <path d="M5 6h14a2 2 0 012 2v7a2 2 0 01-2 2H9l-4 3v-3H5a2 2 0 01-2-2V8a2 2 0 012-2z" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" />
    </svg>
  )
}

export function TasteTabBar({
  active,
  onChange,
}: {
  active: TasteMainTab
  onChange: (tab: TasteMainTab) => void
}) {
  return (
    <nav
      className="relative z-20 shrink-0 border-t border-gray-100/80 bg-white/82 backdrop-blur-md"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="grid grid-cols-4 px-1 pt-1.5">
        {TABS.map(({ id, label }) => {
          const isActive = active === id
          return (
            <Pressable
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="flex flex-col items-center gap-1 py-2"
              aria-current={isActive ? 'page' : undefined}
            >
              <TabIcon tab={id} active={isActive} />
              <span
                className={`text-[10px] tracking-[0.02em] ${isActive ? 'font-medium text-[#1C1C1E]' : 'text-neutral-400'}`}
              >
                {label}
              </span>
            </Pressable>
          )
        })}
      </div>
    </nav>
  )
}
