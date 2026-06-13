import { useId } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type MomentsErrorAlertDialogProps = {
  open: boolean
  title?: string
  message: string
  onClose: () => void
}

/** 朋友圈生成失败等：居中弹窗，避免错误贴在底部 sheet 里看不见 */
export function MomentsErrorAlertDialog({
  open,
  title = '生成失败',
  message,
  onClose,
}: MomentsErrorAlertDialogProps) {
  const titleId = useId()
  const descId = useId()

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[500] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <div className="absolute inset-0 bg-black/50" aria-hidden />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[360px] overflow-hidden rounded-[16px] bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 pb-4 pt-5">
              <h2 id={titleId} className="text-center text-[16px] font-semibold text-[#111827]">
                {title}
              </h2>
              <p
                id={descId}
                className="mt-3 max-h-[min(52vh,300px)] overflow-y-auto whitespace-pre-wrap text-left text-[13px] leading-relaxed text-[#4B5563] [scrollbar-width:thin]"
              >
                {message.trim() || '未知错误'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-[48px] w-full border-t border-[#E5E7EB] text-[15px] font-medium text-[#111827] transition-colors active:bg-[#F3F4F6]"
            >
              知道了
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
