import { AnimatePresence, motion } from 'framer-motion'
import { Pressable } from '../../../../components/Pressable'

/** 临时对话条：点击继续；开场白可居中，问卷仍贴底 */
export function DialogueStrip({
  text,
  onContinue,
  continueLabel = '继续',
  hint,
  align = 'bottom',
}: {
  text: string
  onContinue: () => void
  continueLabel?: string
  hint?: string
  /** bottom = 贴底（问卷）；center = 页面垂直居中（开场白） */
  align?: 'bottom' | 'center'
}) {
  const centered = align === 'center'

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col px-4 ${
        centered
          ? 'items-center justify-center pb-[max(16px,env(safe-area-inset-bottom,0px))]'
          : 'justify-end pb-[max(16px,env(safe-area-inset-bottom,0px))]'
      }`}
    >
      {hint ? (
        <p
          className={`text-[11px] tracking-[0.2em] text-rose-400/90 ${
            centered ? 'mb-5 text-center' : 'mb-3 text-center'
          }`}
        >
          {hint}
        </p>
      ) : null}
      <AnimatePresence mode="wait">
        <motion.div
          key={text}
          initial={{ opacity: 0, y: centered ? 8 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: centered ? -8 : -8 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className={`sm-story-line sm-serif px-5 py-4 text-[16px] leading-[1.88] text-[#2D2422] ${
            centered ? 'w-full max-w-md text-center' : ''
          }`}
        >
          {text}
        </motion.div>
      </AnimatePresence>
      <Pressable
        onClick={onContinue}
        className={`sm-btn-primary mt-4 py-3 text-center text-[15px] ${centered ? 'w-full max-w-xs' : ''}`}
      >
        {continueLabel}
      </Pressable>
    </div>
  )
}
