import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

/** 多选模式 · 圆形复选框 */
export function MultiSelectCheck({ checked }: { checked: boolean }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={checked ? 'on' : 'off'}
        initial={{ opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.82 }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300"
        style={{
          borderColor: checked ? '#000000' : undefined,
          backgroundColor: checked ? '#000000' : 'transparent',
        }}
        aria-hidden
      >
        {checked ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
      </motion.span>
    </AnimatePresence>
  )
}

/** 多选复选框列（窄列，与头像并列而非替换头像） */
export function MultiSelectAvatarSlot({ checked }: { checked: boolean }) {
  return (
    <div className="flex h-10 w-6 shrink-0 items-center justify-center" aria-hidden>
      <MultiSelectCheck checked={checked} />
    </div>
  )
}

/** 多选时：复选框 + 头像（或占位）并排；非多选时按 showAvatarColumn 显示头像或占位 */
export function composeMultiSelectLeading(
  multiSelectAvatar: ReactNode | undefined,
  avatarNode: ReactNode,
  showAvatarColumn = true,
): ReactNode {
  const gutter = <div className="h-10 w-10 shrink-0" aria-hidden />
  const trailing = showAvatarColumn ? avatarNode : gutter
  if (!multiSelectAvatar) return trailing
  return (
    <div className="flex shrink-0 flex-row items-center gap-2">
      {multiSelectAvatar}
      {trailing}
    </div>
  )
}
