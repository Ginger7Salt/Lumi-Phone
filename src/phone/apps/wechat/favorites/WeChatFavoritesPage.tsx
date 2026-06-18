import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { Pressable } from '../../../components/Pressable'
import { personaDb } from '../newFriendsPersona/idb'
import { stopFavoriteAudio } from './favoriteAudioController'
import type { FavoriteFilterId, FavoriteItem } from './favoriteItemTypes'
import { FavoritesDiscoveryHeader } from './FavoritesDiscoveryHeader'
import { FavoritesStream } from './FavoritesStream'
import { buildSharedRecordPayloadFromFavorite } from './buildSharedRecordPayload'
import { loadFavoriteItems } from './loadFavoriteItems'
import { ShareContactSheet } from './ShareContactSheet'
import { sendSharedRecordToContact } from './sendSharedRecord'

function FavoriteActionSheet({
  open,
  sourceName,
  onClose,
  onDelete,
}: {
  open: boolean
  sourceName: string
  onClose: () => void
  onDelete: () => void
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="favorite-action-sheet"
          className="fixed inset-0 z-[52000] flex flex-col justify-end bg-black/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="mx-3 mb-[max(12px,env(safe-area-inset-bottom))] overflow-hidden rounded-[20px] bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="border-b border-gray-100 px-5 py-4 text-center text-[12px] text-gray-400">
              来自 {sourceName}
            </p>
            <button
              type="button"
              onClick={onDelete}
              className="w-full py-4 text-[16px] font-medium text-gray-900 active:bg-gray-50"
            >
              取消收藏
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full border-t border-gray-100 py-4 text-[16px] text-gray-500 active:bg-gray-50"
            >
              关闭
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function FavoritesTopBar({ onBack }: { onBack: () => void }) {
  return (
    <div
      className="sticky top-0 z-20 shrink-0 bg-white"
      style={{
        paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
        boxShadow: '0 8px 30px rgba(0,0,0,0.03)',
      }}
    >
      <div className="flex items-center gap-1 px-3 py-3">
        <Pressable
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition-all duration-200 ease-out hover:bg-gray-50"
          aria-label="返回"
        >
          <ArrowLeft className="size-5 text-gray-900" strokeWidth={1.75} />
        </Pressable>
        <div className="min-w-0 flex-1 px-1 text-center">
          <p className="truncate text-[17px] font-semibold tracking-tight text-gray-900">收藏</p>
        </div>
        <div className="h-10 w-10 shrink-0" aria-hidden />
      </div>
    </div>
  )
}

function ShareSuccessToast({ open }: { open: boolean }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="pointer-events-none fixed inset-x-0 top-[20%] z-[53000] flex justify-center px-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="rounded-full bg-gray-900/92 px-5 py-2.5 text-[13px] tracking-wide text-white shadow-lg backdrop-blur-sm">
            记忆切片已投递 (Record forwarded).
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function WeChatFavoritesPage({
  contacts,
  onBack,
  onOpenChat,
}: {
  contacts: WeChatContactRow[]
  onBack: () => void
  onOpenChat: (characterId: string) => void
}) {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FavoriteFilterId>('all')
  const [actionTarget, setActionTarget] = useState<FavoriteItem | null>(null)
  const [shareTarget, setShareTarget] = useState<FavoriteItem | null>(null)
  const [shareSending, setShareSending] = useState(false)
  const [shareToastOpen, setShareToastOpen] = useState(false)

  const nameByCharId = useMemo(() => {
    const names = new Map<string, string>()
    for (const c of contacts) {
      const id = c.id.trim()
      if (!id) continue
      names.set(id, c.remarkName?.trim() || '未命名')
    }
    return names
  }, [contacts])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await loadFavoriteItems(nameByCharId))
    } finally {
      setLoading(false)
    }
  }, [nameByCharId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const onStorage = () => void reload()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [reload])

  useEffect(() => () => stopFavoriteAudio(), [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (filter === 'voice' && item.type !== 'voice') return false
      if (filter === 'text' && item.type !== 'text') return false
      if (filter === 'image' && item.type !== 'image') return false
      if (!q) return true
      const hay = [
        item.sourceName,
        item.type === 'text' ? item.content : '',
        item.type === 'voice' ? item.transcript ?? '' : '',
        ...(item.tags ?? []),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [items, search, filter])

  const handleDelete = async () => {
    if (!actionTarget) return
    await personaDb.deleteFavorite(actionTarget.id)
    setActionTarget(null)
    await reload()
  }

  const handleShareConfirm = async (characterId: string) => {
    if (!shareTarget || shareSending) return
    setShareSending(true)
    try {
      const payload = await buildSharedRecordPayloadFromFavorite(shareTarget)
      const result = await sendSharedRecordToContact(characterId, payload)
      setShareTarget(null)
      setShareToastOpen(true)
      window.setTimeout(() => setShareToastOpen(false), 2200)
      onOpenChat(result.characterId)
    } finally {
      setShareSending(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F9FAFB] text-gray-900">
      <FavoritesTopBar onBack={onBack} />
      <FavoritesDiscoveryHeader
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[13px] text-gray-400">
            <Loader2 className="mr-2 size-4 animate-spin" />
            加载收藏…
          </div>
        ) : (
          <FavoritesStream
            items={filtered}
            onShare={setShareTarget}
            onOpenActions={setActionTarget}
          />
        )}
      </div>
      <FavoriteActionSheet
        open={actionTarget != null}
        sourceName={actionTarget?.sourceName ?? ''}
        onClose={() => setActionTarget(null)}
        onDelete={() => void handleDelete()}
      />
      <ShareContactSheet
        open={shareTarget != null}
        sending={shareSending}
        onClose={() => {
          if (shareSending) return
          setShareTarget(null)
        }}
        onConfirm={handleShareConfirm}
      />
      <ShareSuccessToast open={shareToastOpen} />
    </div>
  )
}
