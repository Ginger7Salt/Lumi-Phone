import { Pin, PinOff, SquarePen, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

type UserMomentEditMenuProps = {
  isPinned?: boolean
  onTogglePin: () => void
  onDelete?: () => void
  /** 角色朋友圈仅置顶，不提供删除 */
  showDelete?: boolean
}

export function UserMomentEditMenu({
  isPinned,
  onTogglePin,
  onDelete,
  showDelete = true,
}: UserMomentEditMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const handleDelete = () => {
    setOpen(false)
    const ok = window.confirm('确定删除这条朋友圈吗？\n\n删除后无法恢复。')
    if (ok) onDelete?.()
  }

  const handlePin = () => {
    setOpen(false)
    onTogglePin()
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] text-[#6B7280] transition-colors hover:bg-black/[0.04]"
        aria-label="编辑朋友圈"
        aria-expanded={open}
      >
        <SquarePen className="size-3.5" />
        编辑
      </motion.button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            className="absolute right-0 top-8 z-20 min-w-[136px] overflow-hidden rounded-lg border border-black/10 bg-white py-1 shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
          >
            <button
              type="button"
              onClick={handlePin}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-[#111827] hover:bg-black/[0.03]"
            >
              {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              {isPinned ? '取消置顶' : '置顶朋友圈'}
            </button>
            {showDelete ? (
              <>
                <div className="mx-2 border-t border-black/5" />
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-[#DC2626] hover:bg-red-50/80"
                >
                  <Trash2 className="size-3.5" />
                  删除朋友圈
                </button>
              </>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
