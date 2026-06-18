import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import type { WeChatPersonaContact } from '../../../types'
import { Pressable } from '../../../components/Pressable'
import { stopFavoriteAudio } from './favoriteAudioController'
import type { FavoriteFilterId, FavoriteItem } from './favoriteItemTypes'
import { FavoritesDiscoveryHeader } from './FavoritesDiscoveryHeader'
import { FavoritesStream } from './FavoritesStream'
import { loadFavoriteItems } from './loadFavoriteItems'

const PICKER_Z = 5200

function getWeChatPageRoot(): HTMLElement | null {
  return document.querySelector('[data-phone-page="wechat"]')
}

function PickerTopBar({ onClose, sending }: { onClose: () => void; sending: boolean }) {
  return (
    <header
      className="shrink-0 border-b border-gray-100 bg-white"
      style={{
        paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
        boxShadow: '0 8px 30px rgba(0,0,0,0.03)',
      }}
    >
      <div className="flex items-center gap-1 px-3 py-3">
        <Pressable
          onClick={onClose}
          disabled={sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition-all duration-200 ease-out hover:bg-gray-50 disabled:opacity-45"
          aria-label="关闭"
        >
          <ArrowLeft className="size-5 text-gray-900" strokeWidth={1.75} />
        </Pressable>
        <div className="min-w-0 flex-1 px-1 text-center">
          <p className="truncate text-[17px] font-semibold tracking-tight text-gray-900">选择收藏</p>
        </div>
        <div className="h-10 w-10 shrink-0" aria-hidden />
      </div>
    </header>
  )
}

export function ChatRoomFavoritesPicker({
  open,
  sending,
  onClose,
  onPick,
  personaContacts = [],
}: {
  open: boolean
  sending: boolean
  onClose: () => void
  onPick: (item: FavoriteItem) => void
  personaContacts?: readonly WeChatPersonaContact[]
}) {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FavoriteFilterId>('all')
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(() => getWeChatPageRoot())

  const nameByCharId = useMemo(() => {
    const names = new Map<string, string>()
    for (const c of personaContacts) {
      const id = c.characterId.trim()
      if (!id) continue
      names.set(id, c.remarkName?.trim() || '未命名')
    }
    return names
  }, [personaContacts])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await loadFavoriteItems(nameByCharId))
    } finally {
      setLoading(false)
    }
  }, [nameByCharId])

  useEffect(() => {
    if (!open) return
    setPortalRoot(getWeChatPageRoot())
  }, [open])

  useEffect(() => {
    if (!open) return
    void reload()
  }, [open, reload])

  useEffect(() => {
    if (!open) return
    const onStorage = () => void reload()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [open, reload])

  useEffect(() => {
    if (!open) return
    return () => stopFavoriteAudio()
  }, [open])

  useEffect(() => {
    if (!open) {
      setSearch('')
      setFilter('all')
    }
  }, [open])

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

  if (!portalRoot) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="chat-room-favorites-picker"
          className="fixed inset-0 flex flex-col bg-[#F9FAFB] text-gray-900"
          style={{ zIndex: PICKER_Z }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <PickerTopBar onClose={onClose} sending={sending} />
          <FavoritesDiscoveryHeader
            search={search}
            onSearchChange={setSearch}
            filter={filter}
            onFilterChange={setFilter}
          />
          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-[13px] text-gray-400">
                <Loader2 className="mr-2 size-4 animate-spin" />
                加载收藏…
              </div>
            ) : (
              <>
                <p className="px-4 pb-1 pt-2 text-center text-[11px] text-gray-400">
                  点击卡片右下角发送图标，投递到当前聊天
                </p>
                <FavoritesStream items={filtered} variant="picker" onShare={onPick} />
              </>
            )}
            {sending ? (
              <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-white/35 pb-10">
                <div className="rounded-full bg-gray-900/90 px-4 py-2 text-[13px] text-white shadow-lg">
                  发送中…
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalRoot,
  )
}
