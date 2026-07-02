import { ChevronLeft, ChevronRight, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { DiaryEntry } from './diaryTypes'
import { diaryFontLabel } from './diaryFonts'
import { formatDiaryPreviewDate, loadDiaryStoryYearHint } from './diaryInUniverseTime'
import { resolveCharacterRealName } from './resolveCharacterRealName'
import { useDiaryStore } from './useDiaryStore'

type DiaryBookPreviewProps = {
  charId: string
  displayName: string
  avatarUrl?: string
  generating: boolean
  generateError: string | null
  onBack: () => void
  onOpenEntry: (entryId: string) => void
  onForceGenerate: () => void
  onDeleteEntry: (entryId: string) => void
}

function EntryRow({
  entry,
  index,
  storyYearHint,
  deletePending,
  onOpen,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  entry: DiaryEntry
  index: number
  storyYearHint: string | null
  deletePending: boolean
  onOpen: () => void
  onDeleteRequest: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}) {
  const previewDate = formatDiaryPreviewDate(entry.inUniverseTime, storyYearHint)
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-black/[0.05] bg-white px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-[#fafaf8]"
      >
        <span className="shrink-0 text-[13px] tabular-nums text-gray-300">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-medium text-gray-800">{entry.title}</div>
          {previewDate ? (
            <time className="mt-0.5 block truncate text-[12px] text-gray-400">{previewDate}</time>
          ) : null}
        </div>
        <ChevronRight className="size-4 shrink-0 text-gray-300" strokeWidth={1.5} />
      </button>

      {deletePending ? (
        <div className="flex w-[88px] shrink-0 flex-col justify-center gap-1 rounded-2xl border border-red-100 bg-red-50/80 px-2 py-2">
          <button
            type="button"
            onClick={onDeleteConfirm}
            className="rounded-lg bg-red-600 px-2 py-1.5 text-[11px] text-white"
          >
            删除
          </button>
          <button type="button" onClick={onDeleteCancel} className="text-[11px] text-gray-400">
            取消
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label="删除这篇日记"
          onClick={onDeleteRequest}
          className="flex w-10 shrink-0 items-center justify-center rounded-2xl border border-black/[0.05] bg-white text-gray-300 shadow-sm transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="size-4" strokeWidth={1.5} />
        </button>
      )}
    </div>
  )
}

export function DiaryBookPreview({
  charId,
  displayName,
  avatarUrl,
  generating,
  generateError,
  onBack,
  onOpenEntry,
  onForceGenerate,
  onDeleteEntry,
}: DiaryBookPreviewProps) {
  const book = useDiaryStore((s) => s.getBook(charId))
  const resetFontFamily = useDiaryStore((s) => s.resetFontFamily)
  const entries = useMemo(() => book?.entries ?? [], [book?.entries])
  const [resetConfirm, setResetConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [characterRealName, setCharacterRealName] = useState(displayName)
  const [storyYearHint, setStoryYearHint] = useState<string | null>(null)

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
    let cancelled = false
    void resolveCharacterRealName(charId, displayName).then((name) => {
      if (!cancelled) setCharacterRealName(name)
    })
    return () => {
      cancelled = true
    }
  }, [charId, displayName])

  const fontLabel = diaryFontLabel(book?.fontFamily ?? null)

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-gray-50/50">
      <header
        className="flex shrink-0 items-center border-b border-black/[0.04] bg-gray-50/80 px-3 pb-3 backdrop-blur-sm"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          aria-label="返回藏书阁"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-800 transition-colors hover:bg-black/[0.04]"
        >
          <ChevronLeft className="size-5" strokeWidth={1.5} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[16px] font-medium text-gray-900">{characterRealName}</div>
          <div className="text-[10px] tracking-[0.2em] text-gray-400">日记预览</div>
        </div>
        <div className="w-10" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-36 pt-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto max-w-[480px]">
          <div className="flex flex-col items-center text-center">
            <div className="h-20 w-20 overflow-hidden rounded-full bg-gray-100 ring-1 ring-black/5">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[28px] text-gray-400">
                  {characterRealName.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="mt-4 text-[22px] font-medium leading-snug text-gray-900">{characterRealName}</div>
            <div className="mt-1 text-[12px] text-gray-400">
              {entries.length > 0 ? `共 ${entries.length} 篇潜意识碎片` : '尚无日记收录'}
            </div>
            {fontLabel ? (
              <div className="mt-2 text-[12px] text-gray-400">当前笔迹：{fontLabel}</div>
            ) : (
              <div className="mt-2 text-[12px] text-gray-400">笔迹尚未绑定，生成首篇后锁定</div>
            )}
          </div>

          <div className="mt-5 flex justify-center">
            {!resetConfirm ? (
              <button
                type="button"
                disabled={!book?.fontFamily}
                onClick={() => setResetConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-[12px] text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-35"
              >
                <RotateCcw className="size-3.5" strokeWidth={1.5} />
                重置字体
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-[12px]">
                <span className="text-gray-500">将清除笔迹绑定，下次生成重新选字</span>
                <button
                  type="button"
                  className="rounded-full bg-gray-900 px-3 py-1 text-white"
                  onClick={() => {
                    resetFontFamily(charId)
                    setResetConfirm(false)
                  }}
                >
                  确认
                </button>
                <button type="button" className="px-2 text-gray-400" onClick={() => setResetConfirm(false)}>
                  取消
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3">
            {entries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 px-6 py-10 text-center">
                <p className="text-[14px] text-gray-500">还没有窥探到任何思绪</p>
                <p className="mt-2 text-[12px] leading-relaxed text-gray-400">
                  点击下方按钮生成第一篇日记，此后历史将在此留存。
                </p>
              </div>
            ) : (
              entries.map((entry, index) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  index={index}
                  storyYearHint={storyYearHint}
                  deletePending={deleteTargetId === entry.id}
                  onOpen={() => onOpenEntry(entry.id)}
                  onDeleteRequest={() => setDeleteTargetId(entry.id)}
                  onDeleteConfirm={() => {
                    onDeleteEntry(entry.id)
                    setDeleteTargetId(null)
                  }}
                  onDeleteCancel={() => setDeleteTargetId(null)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {generateError ? (
        <div className="absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-10 rounded-xl border border-red-100 bg-red-50/90 px-3 py-2 text-center text-[12px] text-red-600">
          {generateError}
        </div>
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-black/[0.04] bg-gray-50/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-sm">
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
    </div>
  )
}
