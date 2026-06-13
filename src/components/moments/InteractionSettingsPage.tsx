import { ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'

import { MomentsMinimalSwitch } from './MomentsMinimalSwitch'
import { useMomentsSettingsStore } from './useMomentsSettingsStore'
import { useMomentsStore } from './useMomentsStore'

type InteractionSettingsPageProps = {
  onBack: () => void
}

export function InteractionSettingsPage({ onBack }: InteractionSettingsPageProps) {
  const { settings, patchSettings } = useMomentsSettingsStore()
  const clearAllNotices = useMomentsStore((s) => s.clearAllNotices)

  const handleClearAll = () => {
    const ok = window.confirm('确定清空所有互动消息吗？\n\n清空后消息列表将为空，此操作不可撤销。')
    if (!ok) return
    clearAllNotices()
  }

  return (
    <motion.div
      className="absolute inset-0 z-[450] flex flex-col bg-[#FAFAFA]"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 42 }}
    >
      <header
        className="relative flex shrink-0 items-center border-b border-gray-100 bg-white px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/[0.04]"
        >
          <ChevronLeft className="size-5 text-[#111827]" strokeWidth={1.5} />
        </button>
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-semibold text-[#111827]">
          消息管理
        </h1>
        <div className="w-10 shrink-0" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <section className="rounded-2xl bg-white px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
                DIRECT ONLY
              </p>
              <h2 className="mt-1 text-[15px] font-semibold text-[#111827]">仅提醒朋友与我的互动</h2>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                开启后，朋友点赞、评论我互动过的朋友圈时，我将不会收到提醒，但仍可在消息列表中查看。
              </p>
            </div>
            <MomentsMinimalSwitch
              checked={settings.onlyDirectInteraction}
              onChange={(next) => patchSettings({ onlyDirectInteraction: next })}
              label="仅提醒朋友与我的互动"
            />
          </div>
        </section>

        <button
          type="button"
          onClick={handleClearAll}
          className="mt-6 w-full rounded-2xl bg-white py-4 text-center text-[13px] font-medium tracking-[0.06em] text-red-900/80 transition-colors hover:bg-gray-50"
        >
          <span className="block text-[10px] uppercase tracking-[0.18em] text-red-900/60">CLEAR ALL</span>
          <span className="mt-0.5 block">清空所有消息</span>
        </button>
      </div>
    </motion.div>
  )
}
