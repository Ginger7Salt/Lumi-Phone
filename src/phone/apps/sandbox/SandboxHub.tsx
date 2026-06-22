import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'

export function SandboxHub({ onBack, onEnterStarMaker }: { onBack: () => void; onEnterStarMaker: () => void }) {
  const { themeStyle } = useCustomization()

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[#FFFBFB]"
      data-phone-page="app"
      data-app-id="sandbox"
      style={{ ...themeStyle, fontFamily: 'var(--phone-font)', color: '#2D2422' }}
    >
      <header
        className="flex shrink-0 items-center gap-2 border-b border-rose-100/60 px-3 pb-2"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full" aria-label="返回">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <h1 className="font-serif text-[17px] font-semibold">幻境引擎</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="text-[13px] leading-relaxed text-stone-500">
          官方内置高阶文字模拟，在幻境中体验完整经纪人人生。
        </p>

        <Pressable onClick={onEnterStarMaker} className="mt-4 block">
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="overflow-hidden rounded-[22px] bg-gradient-to-br from-rose-50 via-white to-rose-100/80 p-5 shadow-lg shadow-rose-200/25 ring-1 ring-rose-200/40"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-300 to-rose-400 text-white shadow-md">
                <Sparkles size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-[17px] font-semibold text-stone-800">金牌制作人</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
                  乙女向高自由度养成 · 公司经营 · 艺人培养 · 恋爱修罗场 · 买房买车全球旅行
                </p>
                <span className="mt-3 inline-block rounded-full bg-rose-400/90 px-3 py-1 text-[12px] font-medium text-white">
                  进入游戏
                </span>
              </div>
            </div>
          </motion.div>
        </Pressable>

        <p className="mt-6 text-center text-[12px] text-stone-400">更多模拟器敬请期待</p>
      </div>
    </div>
  )
}
