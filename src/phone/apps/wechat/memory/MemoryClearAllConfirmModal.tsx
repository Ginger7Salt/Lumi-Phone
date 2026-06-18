import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Pressable } from '../../../components/Pressable'

export function MemoryClearAllConfirmModal({
  open,
  characterName,
  memoryCount,
  visibleMemoryCount,
  busy,
  onCancel,
  onConfirm,
  zIndex = 56000,
}: {
  open: boolean
  characterName: string
  /** 将删除的总条数（含其他微信账号 / 存储桶内全部） */
  memoryCount: number
  /** 当前列表可见条数（有筛选时可能与 memoryCount 不同） */
  visibleMemoryCount?: number
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
  zIndex?: number
}) {
  if (typeof document === 'undefined') return null

  const showVisibleHint =
    typeof visibleMemoryCount === 'number' &&
    visibleMemoryCount >= 0 &&
    visibleMemoryCount !== memoryCount

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="memory-clear-all"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-clear-all-title"
          className="fixed inset-0 flex items-center justify-center px-5"
          style={{ zIndex, background: 'rgba(17,24,39,0.32)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={busy ? undefined : onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="w-full max-w-[min(360px,100vw)] overflow-hidden rounded-[24px] bg-white px-5 pb-5 pt-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="memory-clear-all-title" className="text-center text-[17px] font-semibold text-gray-900">
              清空全部记忆？
            </p>
            <p className="mt-3 text-center text-[14px] leading-relaxed text-gray-500">
              将删除「{characterName}」的全部
              <span className="font-medium text-gray-700"> {memoryCount} </span>
              条记忆（含所有微信账号与关联存储），删除后无法恢复。
              {showVisibleHint ? (
                <span className="mt-2 block text-[13px] text-gray-400">
                  当前列表显示 {visibleMemoryCount} 条
                  {visibleMemoryCount < memoryCount ? '，其余在其它账号或分类下' : ''}。
                </span>
              ) : null}
            </p>
            <div className="mt-5 flex gap-3">
              <Pressable
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="flex-1 rounded-2xl border border-gray-200 bg-white py-3 text-[14px] font-medium text-gray-800 active:bg-gray-50 disabled:opacity-50"
              >
                取消
              </Pressable>
              <Pressable
                type="button"
                disabled={busy || memoryCount <= 0}
                onClick={onConfirm}
                className="flex-1 rounded-2xl bg-red-600 py-3 text-[14px] font-semibold text-white active:opacity-90 disabled:opacity-50"
              >
                {busy ? '清空中…' : '确认清空'}
              </Pressable>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
