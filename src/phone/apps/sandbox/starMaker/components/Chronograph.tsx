import { motion } from 'framer-motion'
import type { SimTab } from '../types'
import { PERIOD_LABELS } from '../types'
import { useSimulatorStore } from '../useSimulatorStore'
import { SimNum } from './SimNum'

function seasonFromMonth(m: number): string {
  if (m >= 3 && m <= 5) return '春'
  if (m >= 6 && m <= 8) return '夏'
  if (m >= 9 && m <= 11) return '秋'
  return '冬'
}

function hourFromActionIndex(used: number): number {
  const slots = [8, 12, 14, 18, 20, 24]
  return slots[Math.min(used, 5)] ?? 8
}

const TABS: { id: SimTab; label: string }[] = [
  { id: 'schedule', label: '热搜' },
  { id: 'roster', label: '旗下' },
  { id: 'social', label: '联络' },
  { id: 'assets', label: '资产' },
  { id: 'profile', label: '我的' },
]

export function GlassTabBar({ tab, onTab }: { tab: SimTab; onTab: (t: SimTab) => void }) {
  return (
    <nav className="sm-glass-nav shrink-0 px-3 pb-[max(10px,env(safe-area-inset-bottom,0px))] pt-2">
      <div className="flex justify-around">
        {TABS.map(({ id, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTab(id)}
              className="relative flex flex-col items-center gap-1 px-3 py-1"
            >
              <span
                className={`text-[12px] tracking-[0.1em] transition-colors ${
                  active ? 'sm-serif font-semibold text-rose-500' : 'text-stone-500'
                }`}
              >
                {label}
              </span>
              {active ? (
                <motion.span
                  layoutId="sm-tab-dot"
                  className="h-0.5 w-5 rounded-full bg-rose-400"
                />
              ) : (
                <span className="h-0.5 w-5" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export function Chronograph() {
  const gameYear = useSimulatorStore((s) => s.gameYear)
  const gameMonth = useSimulatorStore((s) => s.gameMonth)
  const gameDay = useSimulatorStore((s) => s.gameDay)
  const actionsUsedToday = useSimulatorStore((s) => s.actionsUsedToday)

  const period =
    actionsUsedToday < 2 ? 'morning' : actionsUsedToday < 4 ? 'afternoon' : 'evening'
  const hour = hourFromActionIndex(actionsUsedToday)

  return (
    <div className="sm-chronograph shrink-0 px-4 py-3">
      <p className="sm-serif text-[12px] tracking-[0.2em] text-rose-400/90">金牌制作人</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="sm-serif text-[18px] font-semibold text-stone-800">
          第<SimNum>{gameYear}</SimNum>年 · {seasonFromMonth(gameMonth)} · {PERIOD_LABELS[period]}
        </span>
        <SimNum className="text-[15px] text-stone-600">
          {String(hour).padStart(2, '0')}：00
        </SimNum>
      </div>
      <p className="mt-1 text-[12px] text-stone-500">
        <SimNum>{gameMonth}</SimNum>月<SimNum>{gameDay}</SimNum>日
      </p>
    </div>
  )
}
