import { create } from 'zustand'

import type { InteractionNotice } from './interactionNoticeTypes'
import {
  loadInteractionNoticeState,
  saveInteractionNoticeState,
} from './momentNoticeStorage'

type MomentsNoticeStore = {
  accountId: string | null
  notices: InteractionNotice[]
  processedInteractionIds: Set<string>
  hydrated: boolean

  bindAccount: (accountId: string | null | undefined) => Promise<void>
  pushNotice: (notice: InteractionNotice) => void
  markProcessedInteraction: (interactionId: string) => void
  hasProcessedInteraction: (interactionId: string) => boolean
  markAllRead: () => void
  clearAllNotices: () => void
  getUnreadCount: () => number
  getLatestUnreadNotice: () => InteractionNotice | null
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

function schedulePersist(
  accountId: string | null,
  notices: InteractionNotice[],
  processedInteractionIds: Set<string>,
) {
  if (!accountId?.trim()) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    void saveInteractionNoticeState(accountId, {
      notices,
      processedInteractionIds: [...processedInteractionIds],
    })
  }, 280)
}

export const useMomentsStore = create<MomentsNoticeStore>((set, get) => ({
  accountId: null,
  notices: [],
  processedInteractionIds: new Set(),
  hydrated: false,

  async bindAccount(accountId) {
    const acc = accountId?.trim() || null
    if (acc === get().accountId && get().hydrated) return

    if (!acc) {
      set({
        accountId: null,
        notices: [],
        processedInteractionIds: new Set(),
        hydrated: true,
      })
      return
    }

    const state = await loadInteractionNoticeState(acc)
    set({
      accountId: acc,
      notices: state.notices.sort((a, b) => b.timestamp - a.timestamp),
      processedInteractionIds: new Set(state.processedInteractionIds),
      hydrated: true,
    })
  },

  pushNotice(notice) {
    const { accountId, notices, processedInteractionIds } = get()
    if (!accountId) return

    if (notice.sourceInteractionId && processedInteractionIds.has(notice.sourceInteractionId)) {
      return
    }
    if (notices.some((n) => n.id === notice.id)) return

    const nextProcessed = new Set(processedInteractionIds)
    if (notice.sourceInteractionId) nextProcessed.add(notice.sourceInteractionId)

    const nextNotices = [notice, ...notices].sort((a, b) => b.timestamp - a.timestamp)
    set({ notices: nextNotices, processedInteractionIds: nextProcessed })
    schedulePersist(accountId, nextNotices, nextProcessed)
  },

  markProcessedInteraction(interactionId) {
    const id = interactionId.trim()
    if (!id) return
    const { accountId, processedInteractionIds } = get()
    if (!accountId || processedInteractionIds.has(id)) return
    const nextProcessed = new Set(processedInteractionIds)
    nextProcessed.add(id)
    set({ processedInteractionIds: nextProcessed })
    schedulePersist(accountId, get().notices, nextProcessed)
  },

  hasProcessedInteraction(interactionId) {
    return get().processedInteractionIds.has(interactionId.trim())
  },

  markAllRead() {
    const { accountId, notices } = get()
    if (!accountId || !notices.some((n) => !n.isRead)) return
    const nextNotices = notices.map((n) => (n.isRead ? n : { ...n, isRead: true }))
    set({ notices: nextNotices })
    schedulePersist(accountId, nextNotices, get().processedInteractionIds)
  },

  clearAllNotices() {
    const { accountId } = get()
    if (!accountId) return
    set({ notices: [] })
    schedulePersist(accountId, [], get().processedInteractionIds)
  },

  getUnreadCount() {
    return get().notices.filter((n) => !n.isRead).length
  },

  getLatestUnreadNotice() {
    return get().notices.find((n) => !n.isRead) ?? null
  },
}))
