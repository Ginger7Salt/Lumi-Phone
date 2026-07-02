import { useCallback, useEffect, useRef, useState } from 'react'

import type { AnonymousQaWechatContext } from '../../../../components/anonymousQa/buildAnonymousQaPersonaContext'
import type { MockContact } from '../../../../components/anonymousQa/types'
import { DiaryBookPreview } from './DiaryBookPreview'
import { generateSubconsciousDiaryEntry } from './diaryAi'
import { formatDiaryGenerateError } from './parseDiaryAiResponse'
import { preloadAllDiaryFonts } from './diaryFonts'
import { archiveDiaryEntryToMemory, removeDiaryEntryFromMemory } from './diaryMemoryArchiver'
import { DiaryArchiveHome } from './DiaryArchiveHome'
import { DiaryGenerateOverlay } from './DiaryGenerateOverlay'
import { DiaryReader } from './DiaryReader'
import type { DiaryEntry } from './diaryTypes'
import { useDiaryStore } from './useDiaryStore'

export type SubconsciousArchivesAppProps = {
  onBack: () => void
  contacts?: MockContact[]
  wechatCtx?: AnonymousQaWechatContext | null
  className?: string
}

type BookTarget = {
  charId: string
  displayName: string
  avatarUrl?: string
}

type DiaryView =
  | { kind: 'reader'; entryId: string }
  | null

export function SubconsciousArchivesApp({
  onBack,
  contacts = [],
  wechatCtx = null,
  className = '',
}: SubconsciousArchivesAppProps) {
  const bindAccount = useDiaryStore((s) => s.bindAccount)
  const appendEntry = useDiaryStore((s) => s.appendEntry)
  const deleteEntry = useDiaryStore((s) => s.deleteEntry)
  const getBook = useDiaryStore((s) => s.getBook)
  const ensureBook = useDiaryStore((s) => s.ensureBook)
  const booksDueForAutoWrite = useDiaryStore((s) => s.booksDueForAutoWrite)
  const hydrated = useDiaryStore((s) => s.hydrated)

  const [preview, setPreview] = useState<BookTarget | null>(null)
  const [diaryView, setDiaryView] = useState<DiaryView>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const generatingRef = useRef(false)
  const autoTickRef = useRef(false)

  useEffect(() => {
    void preloadAllDiaryFonts()
  }, [])

  useEffect(() => {
    void bindAccount(wechatCtx?.wechatAccountId ?? null)
  }, [bindAccount, wechatCtx?.wechatAccountId])

  const runGenerate = useCallback(
    async (charId: string, opts?: { silent?: boolean }) => {
      if (!wechatCtx || generatingRef.current) return
      generatingRef.current = true
      if (!opts?.silent) {
        setGenerating(true)
        setGenerateError(null)
      }

      try {
        const book = getBook(charId) ?? ensureBook(charId)
        const ai = await generateSubconsciousDiaryEntry({
          characterId: charId,
          wechatCtx,
          existingFontFamily: book.fontFamily,
          recentEntries: book.entries.map((e) => ({
            title: e.title,
            inUniverseTime: e.inUniverseTime,
          })),
        })

        const entry: DiaryEntry = {
          id: `diary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: ai.title,
          inUniverseTime: ai.inUniverseTime,
          content: ai.content,
          createdAt: Date.now(),
        }

        appendEntry(charId, entry, ai.font_style ?? null)

        await archiveDiaryEntryToMemory({
          characterId: charId,
          entry,
          memorySummary: ai.memorySummary,
          wechatAccountId: wechatCtx.wechatAccountId,
          sessionPlayerIdentityId: wechatCtx.playerIdentityId,
        })
      } catch (err) {
        const msg = formatDiaryGenerateError(err)
        if (!opts?.silent) setGenerateError(msg)
      } finally {
        generatingRef.current = false
        if (!opts?.silent) setGenerating(false)
      }
    },
    [appendEntry, ensureBook, getBook, wechatCtx],
  )

  const handleDeleteEntry = useCallback(
    async (charId: string, entryId: string) => {
      deleteEntry(charId, entryId)
      try {
        await removeDiaryEntryFromMemory(entryId)
      } catch {
        // 记忆可能已不存在，忽略
      }
      if (diaryView?.kind === 'reader' && diaryView.entryId === entryId) {
        setDiaryView(null)
      }
    },
    [deleteEntry, diaryView],
  )

  useEffect(() => {
    if (!hydrated || !wechatCtx) return

    const tick = async () => {
      if (generatingRef.current || autoTickRef.current) return
      const due = booksDueForAutoWrite()
      if (!due.length) return
      autoTickRef.current = true
      try {
        for (const book of due) {
          await runGenerate(book.charId, { silent: true })
        }
      } finally {
        autoTickRef.current = false
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), 60_000)
    return () => window.clearInterval(id)
  }, [booksDueForAutoWrite, hydrated, runGenerate, wechatCtx])

  if (preview && diaryView?.kind === 'reader') {
    return (
      <div className={`flex h-full min-h-0 flex-col ${className}`}>
        <DiaryReader
          charId={preview.charId}
          displayName={preview.displayName}
          focusEntryId={diaryView.entryId}
          generating={generating}
          generateError={generateError}
          onBack={() => {
            setDiaryView(null)
            setGenerateError(null)
          }}
          onDeleteEntry={() => void handleDeleteEntry(preview.charId, diaryView.entryId)}
        />
        <DiaryGenerateOverlay open={generating} />
      </div>
    )
  }

  if (preview) {
    return (
      <div className={`relative flex h-full min-h-0 flex-col ${className}`}>
        <DiaryBookPreview
          charId={preview.charId}
          displayName={preview.displayName}
          avatarUrl={preview.avatarUrl}
          generating={generating}
          generateError={generateError}
          onBack={() => {
            setPreview(null)
            setGenerateError(null)
          }}
          onOpenEntry={(entryId) => {
            setGenerateError(null)
            setDiaryView({ kind: 'reader', entryId })
          }}
          onForceGenerate={() => void runGenerate(preview.charId)}
          onDeleteEntry={(entryId) => void handleDeleteEntry(preview.charId, entryId)}
        />
        <DiaryGenerateOverlay open={generating} />
      </div>
    )
  }

  return (
    <div className={`flex h-full min-h-0 flex-col bg-gray-50/50 ${className}`}>
      <header
        className="flex shrink-0 items-center border-b border-black/[0.04] bg-gray-50/80 px-3 pb-3 backdrop-blur-sm"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          aria-label="返回发现"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-800 transition-colors hover:bg-black/[0.04]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-[17px] font-semibold text-gray-950">私语档案</h1>
          <p className="text-[10px] tracking-[0.22em] text-gray-400">Subconscious Archives</p>
        </div>
        <div className="w-10" />
      </header>

      <DiaryArchiveHome
        contacts={contacts}
        onOpenPreview={(charId, displayName, avatarUrl) => {
          setGenerateError(null)
          setPreview({ charId, displayName, avatarUrl })
        }}
      />
      <DiaryGenerateOverlay open={generating} />
    </div>
  )
}
