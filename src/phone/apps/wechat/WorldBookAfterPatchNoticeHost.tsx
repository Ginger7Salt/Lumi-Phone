import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import {
  WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT,
  type WorldBookAfterPatchUpdatedEventDetail,
} from './newFriendsPersona/worldBookAfterPatch'

/**
 * 全局挂载：模型回传尾声延展覆盖并成功写库后弹出说明。
 * 持久展示直至用户点击「知道了」，无自动消失，避免错过。
 */
export function WorldBookAfterPatchNoticeHost() {
  const [open, setOpen] = useState(false)
  const [patchCount, setPatchCount] = useState(1)

  const dismiss = useCallback(() => {
    setOpen(false)
  }, [])

  useEffect(() => {
    const onUpdated = (ev: Event) => {
      const ce = ev as CustomEvent<WorldBookAfterPatchUpdatedEventDetail>
      const raw = ce.detail?.appliedPatchCount
      const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(1, Math.round(raw)) : 1
      setPatchCount(n)
      setOpen(true)
    }
    window.addEventListener(WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT, onUpdated)
    return () => {
      window.removeEventListener(WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT, onUpdated)
    }
  }, [])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1250] flex items-center justify-center bg-black/35 px-5 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="wb-after-patch-notice-title"
          aria-describedby="wb-after-patch-notice-desc"
        >
          <motion.div
            className="relative w-full max-w-[min(340px,92vw)] rounded-2xl border border-stone-200/90 bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
            initial={{ scale: 0.94, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 8, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <p id="wb-after-patch-notice-title" className="text-[17px] font-semibold tracking-tight text-stone-900">
              尾声延展已更新
            </p>
            <p id="wb-after-patch-notice-desc" className="mt-2 text-[14px] leading-relaxed text-stone-600">
              模型在本轮回复中提交了世界书覆盖，共 {patchCount} 条「尾声延展」条目内容已写入人设。可在
              <span className="font-medium text-stone-800">人设 · 世界书</span>中查看最新正文。
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-stone-500">请点下方按钮关闭本提示。</p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-stone-900 py-3 text-[15px] font-medium text-white transition-colors hover:bg-stone-800 active:scale-[0.99]"
              onClick={dismiss}
            >
              知道了
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
