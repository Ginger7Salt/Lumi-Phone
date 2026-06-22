import { motion } from 'framer-motion'
import { Pressable } from '../../../../components/Pressable'

export function DateOverlay({
  title,
  lines,
  onClose,
}: {
  title: string
  lines: string[]
  onClose: () => void
}) {
  return (
    <motion.div
      className="absolute inset-0 z-[92] flex flex-col bg-gradient-to-b from-[#FFFBFB] to-[#FFF5F7] px-5 pb-8 pt-[max(16px,env(safe-area-inset-top,0px))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <p className="text-[12px] tracking-[0.2em] text-rose-400">专属约会</p>
      <h2 className="sm-serif mt-2 text-[22px] font-semibold text-[#2D2422]">{title}</h2>
      <div className="mt-8 flex min-h-0 flex-1 flex-col justify-end gap-4">
        {lines.map((line, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.35 }}
            className="sm-story-line sm-serif px-4 py-3 text-[16px] leading-[1.9] text-stone-800"
          >
            {line}
          </motion.p>
        ))}
      </div>
      <Pressable onClick={onClose} className="sm-btn-primary mt-6 py-3.5 text-center text-[15px]">
        结束约会
      </Pressable>
    </motion.div>
  )
}
