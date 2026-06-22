import { AnimatePresence, motion } from 'framer-motion'
import { Check, User, X } from 'lucide-react'
import { createPortal } from 'react-dom'

import type { ListenTogetherUserAvatarSource } from './listenTogetherUserAvatarPreference'

type Props = {
  open: boolean
  onClose: () => void
  source: ListenTogetherUserAvatarSource
  wechatAvatar: string
  neteaseAvatar: string
  onSelect: (source: ListenTogetherUserAvatarSource) => void
}

function AvatarOption({
  label,
  hint,
  src,
  selected,
  disabled,
  onClick,
}: {
  label: string
  hint: string
  src: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
        selected
          ? 'bg-rose-50 ring-1 ring-rose-200/80'
          : 'bg-white/80 ring-1 ring-stone-100 hover:bg-stone-50/80'
      } disabled:cursor-not-allowed disabled:opacity-45`}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-2 ring-white shadow-sm">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User className="size-5 text-stone-400" strokeWidth={1.5} aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-stone-800">{label}</p>
        <p className="mt-0.5 text-[11px] text-stone-400">{hint}</p>
      </div>
      {selected ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-400 text-white">
          <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
        </span>
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-full ring-1 ring-stone-200" aria-hidden />
      )}
    </button>
  )
}

export function ListenTogetherAvatarSourceSheet({
  open,
  onClose,
  source,
  wechatAvatar,
  neteaseAvatar,
  onSelect,
}: Props) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-stone-900/35 p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="选择头像来源"
            className="w-full max-w-[340px] rounded-[28px] bg-gradient-to-b from-white to-stone-50 px-4 py-4 shadow-[0_24px_80px_rgba(120,113,108,0.22)] ring-1 ring-white/80"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-medium text-stone-800">显示头像</h2>
                <p className="mt-0.5 text-[11px] text-stone-400">同步到个人主页与一起听</p>
              </div>
              <button
                type="button"
                aria-label="关闭"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>
            <div className="space-y-2.5">
              <AvatarOption
                label="微信头像"
                hint="使用手机微信应用中的个人头像"
                src={wechatAvatar}
                selected={source === 'wechat'}
                disabled={!wechatAvatar}
                onClick={() => {
                  onSelect('wechat')
                  onClose()
                }}
              />
              <AvatarOption
                label="网易云头像"
                hint="使用已登录网易云账号的头像"
                src={neteaseAvatar}
                selected={source === 'netease'}
                disabled={!neteaseAvatar}
                onClick={() => {
                  onSelect('netease')
                  onClose()
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
