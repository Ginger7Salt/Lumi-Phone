import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import { useCustomization } from '../../CustomizationContext'
import { Pressable } from '../../components/Pressable'
import type { LoreEntry } from '../../worldbook/loreArchiveTypes'
import { removeLoreEntry, useWorldbookStore } from '../../worldbook/worldbookLoreStore'
import { LoreArchiveList } from './LoreArchiveList'
import { LoreEditor, type LoreEditorCharacter } from './LoreEditor'

type Props = { onBack: () => void }

function newEmptyEntry(): LoreEntry {
  return {
    id: crypto.randomUUID(),
    title: '',
    content: '',
    enabled: true,
    plateScope: { mode: 'all' },
    characterScope: { mode: 'all' },
    updatedAt: Date.now(),
  }
}

export function LoreArchiveApp({ onBack }: Props) {
  const { state } = useCustomization()
  const { entries, upsertEntry, hydrated } = useWorldbookStore()
  const [platformTab, setPlatformTab] = useState<'wechat' | 'weibo'>('wechat')
  const [screen, setScreen] = useState<'list' | 'edit'>('list')
  const [draft, setDraft] = useState<LoreEntry | null>(null)
  const [autoSaveAt, setAutoSaveAt] = useState<number | null>(null)
  const [roster, setRoster] = useState<LoreEditorCharacter[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const contacts = state.wechatPersonaContacts
        const npcRows: LoreEditorCharacter[] = (
          await Promise.all(
            contacts.map(async (c) => {
              let avatarUrl = c.avatarUrl?.trim() ?? ''
              let displayName = c.characterId
              try {
                const row = await personaDb.getCharacter(c.characterId)
                if (row?.name?.trim()) displayName = row.name.trim()
                if (row?.avatarUrl?.trim()) avatarUrl = row.avatarUrl.trim()
              } catch {
                // ignore
              }
              return {
                id: c.characterId,
                name: displayName,
                avatarUrl,
                kind: 'npc' as const,
              }
            }),
          )
        ).filter((x) => x.id)
        setRoster(npcRows)
      } catch {
        if (!cancelled) setRoster([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state.wechatPersonaContacts])

  useEffect(() => {
    if (!draft || screen !== 'edit') return
    const t = window.setTimeout(() => {
      upsertEntry({ ...draft, updatedAt: Date.now() })
      setAutoSaveAt(Date.now())
    }, 560)
    return () => window.clearTimeout(t)
  }, [draft, screen, upsertEntry])

  const resolveTargets = useCallback(
    (ids: string[]) =>
      ids.map((id) => {
        const hit = roster.find((r) => r.id === id)
        return {
          id,
          avatarUrl: hit?.avatarUrl ?? '',
          name: hit?.name ?? id.slice(0, 8),
        }
      }),
    [roster],
  )

  const autoSaveLabel = useMemo(() => {
    if (!autoSaveAt) return hydrated ? '改动将自动保存' : '加载中…'
    const d = new Date(autoSaveAt)
    return `已自动保存 ${d.toLocaleTimeString()}`
  }, [autoSaveAt, hydrated])

  const openCreate = useCallback(() => {
    setDraft(newEmptyEntry())
    setScreen('edit')
    setAutoSaveAt(null)
  }, [])

  const openEdit = useCallback(
    (id: string) => {
      const found = entries.find((e) => e.id === id)
      if (!found) return
      setDraft({ ...found })
      setScreen('edit')
      setAutoSaveAt(null)
    },
    [entries],
  )

  const duplicateEntry = useCallback(
    (id: string) => {
      const found = entries.find((e) => e.id === id)
      if (!found) return
      const baseTitle = found.title.trim()
      const clone: LoreEntry = {
        ...found,
        id: crypto.randomUUID(),
        title: baseTitle ? `${baseTitle}（副本）` : '未命名法则（副本）',
        updatedAt: Date.now(),
      }
      upsertEntry(clone)
      setDraft({ ...clone })
      setScreen('edit')
      setAutoSaveAt(null)
    },
    [entries, upsertEntry],
  )

  const moveToWeiboReserved = useCallback(() => {
    window.alert('移至微博板块功能尚在筹备中，敬请期待。')
  }, [])

  const deleteEntry = useCallback(
    (id: string) => {
      const found = entries.find((e) => e.id === id)
      const titleLabel = found?.title.trim() || '未命名法则'
      if (!window.confirm(`确定删除「${titleLabel}」吗？此操作不可撤销。`)) return
      removeLoreEntry(id)
      if (draft?.id === id) {
        setDraft(null)
        setScreen('list')
        setAutoSaveAt(null)
      }
    },
    [entries, draft],
  )

  const setEntryEnabled = useCallback(
    (id: string, enabled: boolean) => {
      const found = entries.find((e) => e.id === id)
      if (!found) return
      upsertEntry({ ...found, enabled, updatedAt: Date.now() })
    },
    [entries, upsertEntry],
  )

  const closeEdit = useCallback(() => {
    if (draft) {
      const empty = !draft.title.trim() && !draft.content.trim()
      if (empty) {
        removeLoreEntry(draft.id)
      } else {
        upsertEntry({ ...draft, updatedAt: Date.now() })
      }
    }
    setDraft(null)
    setScreen('list')
    setAutoSaveAt(null)
  }, [draft, upsertEntry])

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[#fafafa]"
      data-phone-page="app"
      data-app-id="loreArchive"
    >
      <AnimatePresence mode="wait" initial={false}>
        {screen === 'list' ? (
          <motion.div
            key="list"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <header
              className="flex shrink-0 flex-col gap-2 border-b border-black/[0.06] bg-white/80 px-3 pb-2 backdrop-blur-md"
              style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' }}
            >
              <div className="relative flex h-9 items-center justify-center">
                <Pressable
                  onClick={onBack}
                  className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full text-neutral-600"
                  aria-label="返回桌面"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35">
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Pressable>
                <span className="text-[15px] font-medium text-neutral-800">档案室</span>
              </div>
              <div className="flex rounded-xl bg-neutral-100/90 p-0.5">
                <button
                  type="button"
                  onClick={() => setPlatformTab('wechat')}
                  className={`flex-1 rounded-[10px] py-2 text-[13px] font-medium transition-colors ${
                    platformTab === 'wechat' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                  }`}
                >
                  微信
                </button>
                <button
                  type="button"
                  onClick={() => setPlatformTab('weibo')}
                  className={`flex-1 rounded-[10px] py-2 text-[13px] font-medium transition-colors ${
                    platformTab === 'weibo' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                  }`}
                >
                  微博
                </button>
              </div>
            </header>
            {platformTab === 'weibo' ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10 text-center">
                <p className="text-[15px] font-medium text-neutral-700">微博</p>
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">功能预留，敬请期待。</p>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <LoreArchiveList
                  entries={entries}
                  resolveTargets={resolveTargets}
                  onOpenEntry={openEdit}
                  onCreate={openCreate}
                  onSetEntryEnabled={setEntryEnabled}
                  onDuplicateEntry={duplicateEntry}
                  onMoveToWeiboReserved={moveToWeiboReserved}
                  onDeleteEntry={deleteEntry}
                />
              </div>
            )}
          </motion.div>
        ) : draft ? (
          <LoreEditor
            key={draft.id}
            draft={draft}
            roster={roster}
            onChange={setDraft}
            onBack={closeEdit}
            autoSaveLabel={autoSaveLabel}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
