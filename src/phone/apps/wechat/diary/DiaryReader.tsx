import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { LinedDiarySheet } from './LinedDiarySheet'
import {
  buildDiaryVirtualPages,
  computeDiaryPageLayout,
  DIARY_SHEET_PADDING_LEFT,
  DIARY_SHEET_PADDING_RIGHT,
  type DiaryPageLayoutConfig,
} from './diaryPageLayout'
import { ensureDiaryFontsLoaded } from './diaryFonts'
import {
  ensureDiaryInUniverseTimeHasYear,
  loadDiaryStoryYearHint,
} from './diaryInUniverseTime'
import { resolveCharacterRealName } from './resolveCharacterRealName'
import { useDiaryStore } from './useDiaryStore'

type DiaryReaderProps = {
  charId: string
  displayName: string
  focusEntryId?: string | null
  generating: boolean
  generateError: string | null
  onBack: () => void
  onForceGenerate?: () => void
  onDeleteEntry?: () => void
}

function EmptyReader({
  displayName,
  onForceGenerate,
  generating,
}: {
  displayName: string
  onForceGenerate: () => void
  generating: boolean
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-28 text-center">
      <p className="text-[16px] text-gray-600">尚未窥探到 {displayName} 的思绪</p>
      <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-gray-400">
        点击下方按钮，让潜意识在纸页上留下第一行字迹。
      </p>
      <button
        type="button"
        disabled={generating}
        onClick={onForceGenerate}
        className="mt-8 rounded-full bg-gray-950 px-6 py-3 text-[14px] tracking-wide text-white transition-opacity disabled:opacity-50"
      >
        窥探最新思绪
      </button>
    </div>
  )
}

export function DiaryReader({
  charId,
  displayName,
  focusEntryId = null,
  generating,
  generateError,
  onBack,
  onForceGenerate,
  onDeleteEntry,
}: DiaryReaderProps) {
  const book = useDiaryStore((s) => s.getBook(charId))
  const allEntries = useMemo(() => book?.entries ?? [], [book?.entries])
  const entries = useMemo(() => {
    if (!focusEntryId) return allEntries
    const one = allEntries.find((e) => e.id === focusEntryId)
    return one ? [one] : []
  }, [allEntries, focusEntryId])
  const [pageIndex, setPageIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [contentWidth, setContentWidth] = useState(280)
  const [pageLayout, setPageLayout] = useState<DiaryPageLayoutConfig>(() =>
    computeDiaryPageLayout(520),
  )
  const [fontsReady, setFontsReady] = useState(0)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [signatureName, setSignatureName] = useState(displayName)
  const [storyYearHint, setStoryYearHint] = useState<string | null>(null)
  const measureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void resolveCharacterRealName(charId, displayName).then((name) => {
      if (!cancelled) setSignatureName(name)
    })
    return () => {
      cancelled = true
    }
  }, [charId, displayName])

  useEffect(() => {
    setPageIndex(0)
    setDirection(0)
  }, [charId, focusEntryId])

  useEffect(() => {
    let cancelled = false
    void loadDiaryStoryYearHint(charId).then((year) => {
      if (!cancelled) setStoryYearHint(year)
    })
    return () => {
      cancelled = true
    }
  }, [charId])

  useEffect(() => {
    void ensureDiaryFontsLoaded([book?.fontFamily]).then(() => {
      setFontsReady((v) => v + 1)
    })
  }, [book?.fontFamily])

  useEffect(() => {
    const node = measureRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const sheetOuter = node.clientWidth
      const inner = sheetOuter - 24 - DIARY_SHEET_PADDING_LEFT - DIARY_SHEET_PADDING_RIGHT
      if (inner > 0) setContentWidth(inner)
      if (node.clientHeight > 0) setPageLayout(computeDiaryPageLayout(node.clientHeight))
    }
    const ro = new ResizeObserver(() => measure())
    ro.observe(node)
    measure()
    return () => ro.disconnect()
  }, [])

  const virtualPages = useMemo(() => {
    const pages = buildDiaryVirtualPages(
      entries,
      contentWidth,
      book?.fontFamily ?? null,
      pageLayout,
    )
    if (!storyYearHint) return pages
    return pages.map((page) => ({
      ...page,
      inUniverseTime: ensureDiaryInUniverseTimeHasYear(page.inUniverseTime, storyYearHint),
    }))
  }, [book?.fontFamily, contentWidth, entries, fontsReady, pageLayout, storyYearHint])

  const total = virtualPages.length
  const current = total > 0 ? virtualPages[Math.min(pageIndex, total - 1)]! : null

  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= total) {
      setPageIndex(Math.max(0, total - 1))
    }
  }, [pageIndex, total])

  const goPrev = () => {
    if (pageIndex <= 0) return
    setDirection(-1)
    setPageIndex((v) => v - 1)
  }

  const goNext = () => {
    if (pageIndex >= total - 1) return
    setDirection(1)
    setPageIndex((v) => v + 1)
  }

  const entryLabel =
    current && entries.length > 1
      ? `第 ${current.entryIndex + 1} 篇`
      : null

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col bg-[#f7f6f3]"
      style={{ boxShadow: 'inset 0 0 100px rgba(0,0,0,0.02)' }}
    >
      <header
        className="relative z-10 flex shrink-0 items-center border-b border-black/[0.04] bg-[#f7f6f3]/90 px-3 pb-3 backdrop-blur-sm"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          aria-label="返回藏书阁"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-black/[0.04]"
        >
          <ChevronLeft className="size-5" strokeWidth={1.5} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[16px] font-medium text-gray-900">{displayName}</div>
          <div className="text-[10px] tracking-[0.2em] text-gray-400">
            {focusEntryId ? '阅读日记' : '私语档案'}
          </div>
        </div>
        <div className="w-10 shrink-0">
          {focusEntryId && onDeleteEntry ? (
            !deleteConfirm ? (
              <button
                type="button"
                aria-label="删除这篇日记"
                onClick={() => setDeleteConfirm(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="size-4" strokeWidth={1.5} />
              </button>
            ) : (
              <button
                type="button"
                aria-label="确认删除"
                onClick={() => {
                  onDeleteEntry()
                  setDeleteConfirm(false)
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-[11px] text-white"
              >
                删
              </button>
            )
          ) : null}
        </div>
      </header>

      <div ref={measureRef} className="relative min-h-0 flex-1 overflow-hidden">
        {!current ? (
          <EmptyReader
            displayName={displayName}
            generating={generating}
            onForceGenerate={onForceGenerate ?? (() => {})}
          />
        ) : (
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={`${current.entryId}:${current.chunkIndex}`}
              custom={direction}
              className="absolute inset-0 flex flex-col"
              variants={{
                enter: (d: number) => ({ x: d >= 0 ? 100 : -100, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (d: number) => ({ x: d >= 0 ? -100 : 100, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            >
              <LinedDiarySheet
                page={current}
                fontFamily={book?.fontFamily ?? null}
                signatureName={signatureName}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {total > 0 ? (
        <div
          className={`absolute left-0 right-0 z-10 flex flex-col items-center gap-1 ${
            onForceGenerate
              ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))]'
              : 'bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]'
          }`}
        >
          {entryLabel ? (
            <span className="text-[10px] tracking-[0.14em] text-gray-400">{entryLabel}</span>
          ) : null}
          <div className="flex items-center justify-center gap-5 text-gray-500">
            <button
              type="button"
              aria-label="上一页"
              disabled={pageIndex <= 0}
              onClick={goPrev}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-sm transition-colors hover:bg-white disabled:opacity-25"
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </button>
            <span className="min-w-[5rem] text-center font-mono text-[13px] tabular-nums text-gray-600">
              {pageIndex + 1} / {total}
            </span>
            <button
              type="button"
              aria-label="下一页"
              disabled={pageIndex >= total - 1}
              onClick={goNext}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-sm transition-colors hover:bg-white disabled:opacity-25"
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      ) : null}

      {generateError ? (
        <div className="absolute bottom-[calc(8.5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-10 rounded-xl border border-red-100 bg-red-50/90 px-3 py-2 text-center text-[12px] text-red-600">
          {generateError}
        </div>
      ) : null}

      {onForceGenerate ? (
        <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-black/[0.04] bg-[#f7f6f3]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-sm">
          <button
            type="button"
            disabled={generating}
            onClick={onForceGenerate}
            className="mx-auto flex h-11 w-full max-w-[360px] items-center justify-center rounded-full bg-gray-950 text-[13px] tracking-wide text-white transition-opacity disabled:opacity-50"
          >
            <span className="mr-2 text-[11px] text-white/70">&#10022;</span>
            窥探最新思绪
            <span className="ml-2 text-[10px] text-white/45">Force Resonance</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
