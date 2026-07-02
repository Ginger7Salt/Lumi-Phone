import { create } from 'zustand'

import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterDiaryBook, DiaryEntry, DiaryFontStyleCode, DiaryPersistedRoot } from './diaryTypes'
import { DIARY_KV_KEY } from './diaryTypes'
import { pickDiaryFontForRebind, resolveDiaryFontFamily } from './diaryFonts'

type DiaryStore = {
  hydrated: boolean
  currentAccountId: string | null
  root: DiaryPersistedRoot

  bindAccount: (accountId: string | null | undefined) => Promise<void>
  getBook: (charId: string) => CharacterDiaryBook | null
  ensureBook: (charId: string) => CharacterDiaryBook
  setAutoWriteInterval: (charId: string, intervalMs: number) => void
  resetFontFamily: (charId: string) => void
  deleteEntry: (charId: string, entryId: string) => void
  appendEntry: (charId: string, entry: DiaryEntry, fontStyle?: DiaryFontStyleCode | null) => void
  listBooks: () => CharacterDiaryBook[]
  booksDueForAutoWrite: (nowMs?: number) => CharacterDiaryBook[]
}

const EMPTY_ROOT: DiaryPersistedRoot = { byAccount: {} }

let persistTimer: ReturnType<typeof setTimeout> | null = null

function schedulePersist(root: DiaryPersistedRoot) {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    void personaDb.setPhoneKv(DIARY_KV_KEY, root)
  }, 280)
}

function normalizeRoot(raw: unknown): DiaryPersistedRoot {
  if (!raw || typeof raw !== 'object') return { byAccount: {} }
  const byAccount = (raw as DiaryPersistedRoot).byAccount
  if (!byAccount || typeof byAccount !== 'object') return { byAccount: {} }
  const next: DiaryPersistedRoot = { byAccount: {} }
  for (const [acc, data] of Object.entries(byAccount)) {
    if (!acc.trim() || !data || typeof data !== 'object') continue
    const books: Record<string, CharacterDiaryBook> = {}
    const rawBooks = (data as { books?: Record<string, CharacterDiaryBook> }).books ?? {}
    for (const [charId, book] of Object.entries(rawBooks)) {
      if (!charId.trim() || !book || typeof book !== 'object') continue
      const entries = Array.isArray(book.entries)
        ? book.entries
            .filter((e) => e && typeof e === 'object' && typeof e.id === 'string')
            .map((e) => ({
              id: e.id,
              title: String(e.title ?? '').trim() || '无题',
              inUniverseTime: String(e.inUniverseTime ?? '').trim(),
              content: String(e.content ?? '').trim(),
              createdAt: typeof e.createdAt === 'number' ? e.createdAt : Date.now(),
            }))
        : []
      books[charId] = {
        charId,
        fontFamily: typeof book.fontFamily === 'string' && book.fontFamily.trim() ? book.fontFamily.trim() : null,
        fontRebindAvoid:
          typeof book.fontRebindAvoid === 'string' && book.fontRebindAvoid.trim()
            ? book.fontRebindAvoid.trim()
            : null,
        autoWriteInterval:
          typeof book.autoWriteInterval === 'number' && book.autoWriteInterval >= 0 ? book.autoWriteInterval : 0,
        lastWrittenAt: typeof book.lastWrittenAt === 'number' ? book.lastWrittenAt : 0,
        entries: entries.sort((a, b) => b.createdAt - a.createdAt),
      }
    }
    next.byAccount[acc] = { books }
  }
  return next
}

function emptyBook(charId: string): CharacterDiaryBook {
  return {
    charId,
    fontFamily: null,
    fontRebindAvoid: null,
    autoWriteInterval: 0,
    lastWrittenAt: 0,
    entries: [],
  }
}

function patchBook(
  root: DiaryPersistedRoot,
  accountId: string,
  charId: string,
  recipe: (book: CharacterDiaryBook) => CharacterDiaryBook,
): DiaryPersistedRoot {
  const acc = root.byAccount[accountId] ?? { books: {} }
  const current = acc.books[charId] ?? emptyBook(charId)
  return {
    byAccount: {
      ...root.byAccount,
      [accountId]: {
        books: {
          ...acc.books,
          [charId]: recipe(current),
        },
      },
    },
  }
}

export const useDiaryStore = create<DiaryStore>((set, get) => ({
  hydrated: false,
  currentAccountId: null,
  root: EMPTY_ROOT,

  async bindAccount(accountId) {
    const acc = accountId?.trim() || null
    if (acc === get().currentAccountId && get().hydrated) return

    if (!acc) {
      set({ currentAccountId: null, root: EMPTY_ROOT, hydrated: true })
      return
    }

    const raw = await personaDb.getPhoneKv(DIARY_KV_KEY)
    set({
      currentAccountId: acc,
      root: normalizeRoot(raw),
      hydrated: true,
    })
  },

  getBook(charId) {
    const acc = get().currentAccountId
    if (!acc) return null
    return get().root.byAccount[acc]?.books[charId] ?? null
  },

  ensureBook(charId) {
    const acc = get().currentAccountId
    if (!acc) return emptyBook(charId)
    const existing = get().root.byAccount[acc]?.books[charId]
    if (existing) return existing
    const book = emptyBook(charId)
    const next = patchBook(get().root, acc, charId, () => book)
    set({ root: next })
    schedulePersist(next)
    return book
  },

  setAutoWriteInterval(charId, intervalMs) {
    const acc = get().currentAccountId
    if (!acc) return
    const ms = Math.max(0, Math.round(intervalMs))
    const next = patchBook(get().root, acc, charId, (book) => ({
      ...book,
      autoWriteInterval: ms,
    }))
    set({ root: next })
    schedulePersist(next)
  },

  resetFontFamily(charId) {
    const acc = get().currentAccountId
    if (!acc) return
    const next = patchBook(get().root, acc, charId, (book) => ({
      ...book,
      fontRebindAvoid: book.fontFamily,
      fontFamily: null,
    }))
    set({ root: next })
    schedulePersist(next)
  },

  deleteEntry(charId, entryId) {
    const acc = get().currentAccountId
    const eid = entryId.trim()
    if (!acc || !eid) return
    const next = patchBook(get().root, acc, charId, (book) => ({
      ...book,
      entries: book.entries.filter((e) => e.id !== eid),
    }))
    set({ root: next })
    schedulePersist(next)
  },

  appendEntry(charId, entry, fontStyle) {
    const acc = get().currentAccountId
    if (!acc) return
    const next = patchBook(get().root, acc, charId, (book) => {
      let lockedFont = book.fontFamily
      if (!lockedFont) {
        if (fontStyle) {
          lockedFont = resolveDiaryFontFamily(fontStyle, charId)
          if (book.fontRebindAvoid && lockedFont === book.fontRebindAvoid) {
            lockedFont = pickDiaryFontForRebind(charId, entry.id, book.fontRebindAvoid)
          }
        } else {
          lockedFont = pickDiaryFontForRebind(charId, entry.id, book.fontRebindAvoid)
        }
      }
      return {
        ...book,
        fontFamily: lockedFont,
        fontRebindAvoid: null,
        lastWrittenAt: entry.createdAt,
        entries: [entry, ...book.entries.filter((e) => e.id !== entry.id)],
      }
    })
    set({ root: next })
    schedulePersist(next)
  },

  listBooks() {
    const acc = get().currentAccountId
    if (!acc) return []
    const books = get().root.byAccount[acc]?.books ?? {}
    return Object.values(books)
  },

  booksDueForAutoWrite(nowMs = Date.now()) {
    return get()
      .listBooks()
      .filter((book) => {
        if (!book.autoWriteInterval) return false
        if (!book.lastWrittenAt) return true
        return nowMs - book.lastWrittenAt >= book.autoWriteInterval
      })
  },
}))
