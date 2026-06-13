import { motion } from 'framer-motion'

import type { MomentsContactDirectory } from './momentsContactDirectory'
import { useMomentsStore } from './useMomentsStore'
import { resolveProfileAvatarPreviewUrl } from '../../phone/utils/characterAvatarUrl'

type MomentNoticeBadgeProps = {
  contactDirectory: MomentsContactDirectory
  onOpenHistory: () => void
}

export function MomentNoticeBadge({ contactDirectory, onOpenHistory }: MomentNoticeBadgeProps) {
  const unreadCount = useMomentsStore((s) => s.notices.filter((n) => !n.isRead).length)
  const latestUnread = useMomentsStore((s) => s.notices.find((n) => !n.isRead) ?? null)
  if (unreadCount <= 0 || !latestUnread) return null

  const avatarUrl = resolveProfileAvatarPreviewUrl(
    contactDirectory.getAvatar(latestUnread.actorId),
  )

  const handleClick = () => {
    onOpenHistory()
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-full z-20 flex h-22 items-center justify-center px-4">
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className="pointer-events-auto inline-flex items-center gap-2.5 rounded-lg bg-gray-800/90 py-2 pl-2 pr-3 shadow-md backdrop-blur-md"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="size-8 shrink-0 rounded-md object-cover"
          />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gray-700 text-[11px] font-medium text-white/80">
            {(contactDirectory.getDisplayName(latestUnread.actorId) || '?').slice(0, 1)}
          </span>
        )}
        <span className="text-[13px] tracking-[0.01em] text-white">
          <span className="font-semibold tabular-nums">{unreadCount}</span>
          <span className="font-medium"> 条新消息</span>
        </span>
      </motion.button>
    </div>
  )
}
