import { motion } from 'framer-motion'

type Props = {
  authorName: string
  targetName: string
}

function BouncingDots() {
  return (
    <span className="inline-flex items-center gap-[3px] pl-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block size-[3px] rounded-full bg-gray-300"
          animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.18,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  )
}

export function ReplyingIndicator({ authorName, targetName }: Props) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 42 }}
      className="overflow-hidden"
    >
      <p className="px-0.5 py-0.5 text-[11px] italic leading-relaxed text-gray-400">
        {authorName} is replying to {targetName}
        <BouncingDots />
      </p>
    </motion.div>
  )
}
