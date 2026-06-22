import { motion } from 'framer-motion'
import { Pressable } from '../../../../components/Pressable'
import { useSimulatorStore } from '../useSimulatorStore'

export function BirthdayEventOverlay() {
  const open = useSimulatorStore((s) => s.pendingBirthday)
  const resolve = useSimulatorStore((s) => s.resolveBirthdayChoice)
  const player = useSimulatorStore((s) => s.player)

  if (!open) return null

  return (
    <motion.div
      className="absolute inset-0 z-[97] flex flex-col justify-end bg-black/25 px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="sm-card rounded-[24px] p-5">
        <p className="text-[12px] tracking-[0.15em] text-rose-400">生日</p>
        <h2 className="sm-serif mt-2 text-[20px] font-semibold text-[#2D2422]">
          {player?.name ?? '你'}，今日是你的生日
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
          霓虹在窗外闪烁，你想如何度过这一夜？
        </p>
        <div className="mt-5 space-y-2">
          <Pressable
            onClick={() => resolve('party')}
            className="sm-btn-primary w-full py-3 text-[15px]"
          >
            邀请高好感艺人，举办私密宴会
          </Pressable>
          <Pressable
            onClick={() => resolve('alone')}
            className="sm-btn-ghost w-full py-3 text-[15px]"
          >
            独自在家，等一个意外敲门
          </Pressable>
        </div>
      </div>
    </motion.div>
  )
}
