import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Pressable } from '../../../../components/Pressable'
import { formatSaveDateTime, SAVE_SLOT_COUNT, SAVE_SLOTS_PER_PAGE, type SaveSlotInfo } from '../saveArchive'
import { useSimulatorStore } from '../useSimulatorStore'
import { SimNum, SimNumText } from '../components/SimNum'

function SaveSlotCell({
  slot,
  selected,
  onSelect,
}: {
  slot: SaveSlotInfo
  selected: boolean
  onSelect: () => void
}) {
  const slotNo = slot.slotIndex + 1

  return (
    <Pressable
      onClick={onSelect}
      className={`flex min-h-[108px] flex-col rounded-xl border p-2.5 text-left transition-colors ${
        selected
          ? 'border-rose-300 bg-rose-50/80 ring-2 ring-rose-300'
          : 'border-rose-100 bg-white/90'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium ${
            selected ? 'bg-rose-400 text-white' : 'bg-rose-100 text-rose-600'
          }`}
        >
          <SimNum>{slotNo}</SimNum>
        </span>
        {slot.hasValidSave ? (
          <span className="truncate text-[10px] text-stone-400">
            <SimNumText text={formatSaveDateTime(slot.savedAt).split(' ')[1] ?? ''} />
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col justify-center">
        {slot.hasValidSave ? (
          <>
            <p className="line-clamp-2 text-[12px] font-medium leading-snug text-[#2D2422]">
              {slot.playerName}
            </p>
            <p className="mt-1 line-clamp-1 text-[10px] text-rose-700">{slot.identityTitle}</p>
            <p className="mt-0.5 line-clamp-1 text-[10px] text-stone-500">
              <SimNumText text={slot.progressLabel} />
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-2 text-center">
            <div className="mb-1.5 h-8 w-8 rounded-lg border border-dashed border-rose-200 bg-rose-50/50" />
            <p className="text-[11px] text-stone-400">空档位</p>
          </div>
        )}
      </div>
    </Pressable>
  )
}

function SelectedSlotDetail({ slot }: { slot: SaveSlotInfo | undefined }) {
  if (!slot) {
    return (
      <div className="sm-card min-h-[88px] p-3.5">
        <p className="text-center text-[13px] text-stone-400">请选择一个存档位</p>
      </div>
    )
  }

  if (!slot.hasValidSave) {
    return (
      <div className="sm-card min-h-[88px] p-3.5">
        <p className="text-[11px] tracking-[0.12em] text-rose-400">
          存档位 <SimNum>{slot.slotIndex + 1}</SimNum>
        </p>
        <p className="mt-2 text-[14px] text-stone-500">此档位暂无存档，可写入当前进度</p>
      </div>
    )
  }

  return (
    <div className="sm-card p-3.5">
      <p className="text-[11px] tracking-[0.12em] text-rose-400">
        存档位 <SimNum>{slot.slotIndex + 1}</SimNum> · 详情
      </p>
      <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-stone-700">
        <p className="text-[15px] font-medium text-[#2D2422]">{slot.playerName}</p>
        <p>
          <span className="text-stone-500">身份 · </span>
          <span className="text-rose-700">{slot.identityTitle}</span>
        </p>
        <p>
          <span className="text-stone-500">进度 · </span>
          <SimNumText text={slot.progressLabel} />
        </p>
        <p>
          <span className="text-stone-500">时间 · </span>
          <SimNumText text={formatSaveDateTime(slot.savedAt)} />
        </p>
      </div>
    </div>
  )
}

function CurrentProgressStrip({ slot }: { slot: SaveSlotInfo }) {
  return (
    <div className="rounded-xl border border-dashed border-rose-200 bg-white/70 px-3 py-2.5">
      <p className="text-[10px] tracking-[0.12em] text-rose-400">当前进度</p>
      <p className="mt-1 truncate text-[13px] font-medium text-[#2D2422]">{slot.playerName}</p>
      <p className="truncate text-[11px] text-stone-500">
        {slot.identityTitle} · <SimNumText text={slot.progressLabel} />
      </p>
    </div>
  )
}

function SaveArchivePager({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}) {
  const startSlot = page * SAVE_SLOTS_PER_PAGE + 1
  const endSlot = Math.min((page + 1) * SAVE_SLOTS_PER_PAGE, SAVE_SLOT_COUNT)

  return (
    <div className="flex items-center justify-between gap-2 px-0.5">
      <Pressable
        onClick={onPrev}
        disabled={page <= 0}
        className="inline-flex h-9 min-w-[72px] items-center justify-center gap-1 rounded-full bg-white px-3 text-[13px] text-stone-600 ring-1 ring-rose-100 disabled:opacity-35"
        aria-label="上一页"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        上一页
      </Pressable>

      <div className="text-center">
        <p className="text-[13px] font-medium text-[#2D2422]">
          第 <SimNum>{page + 1}</SimNum> / <SimNum>{totalPages}</SimNum> 页
        </p>
        <p className="text-[11px] text-stone-500">
          存档位 <SimNum>{startSlot}</SimNum>–<SimNum>{endSlot}</SimNum>
        </p>
      </div>

      <Pressable
        onClick={onNext}
        disabled={page >= totalPages - 1}
        className="inline-flex h-9 min-w-[72px] items-center justify-center gap-1 rounded-full bg-white px-3 text-[13px] text-stone-600 ring-1 ring-rose-100 disabled:opacity-35"
        aria-label="下一页"
      >
        下一页
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Pressable>
    </div>
  )
}

export function SaveArchiveSheet({
  mode,
  onClose,
  onDone,
}: {
  mode: 'save' | 'load'
  onClose: () => void
  onDone?: (message: string) => void
}) {
  const listSaveSlots = useSimulatorStore((s) => s.listSaveSlots)
  const getCurrentSavePreview = useSimulatorStore((s) => s.getCurrentSavePreview)
  const saveGame = useSimulatorStore((s) => s.saveGame)
  const loadGame = useSimulatorStore((s) => s.loadGame)

  const [slots, setSlots] = useState<SaveSlotInfo[]>([])
  const [currentSlot, setCurrentSlot] = useState<SaveSlotInfo>(() => getCurrentSavePreview())
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [page, setPage] = useState(0)
  const [savedIndex, setSavedIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const all = await listSaveSlots()
      setSlots(all)
      setCurrentSlot(getCurrentSavePreview())
      setSelectedIndex((prev) => {
        let next = prev
        if (mode === 'load') {
          const firstValid = all.findIndex((s) => s.hasValidSave)
          if (firstValid >= 0) next = firstValid
        }
        next = Math.min(next, SAVE_SLOT_COUNT - 1)
        setPage(Math.floor(next / SAVE_SLOTS_PER_PAGE))
        return next
      })
    } catch {
      setError('读取存档信息失败')
    } finally {
      setLoading(false)
    }
  }, [getCurrentSavePreview, listSaveSlots, mode])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selectedSlot = slots[selectedIndex]
  const totalPages = Math.ceil(SAVE_SLOT_COUNT / SAVE_SLOTS_PER_PAGE)
  const pageStart = page * SAVE_SLOTS_PER_PAGE
  const pageSlots = slots.slice(pageStart, pageStart + SAVE_SLOTS_PER_PAGE)
  const title = mode === 'save' ? '保存存档' : '载入存档'
  const isSaved = mode === 'save' && savedIndex === selectedIndex
  const canConfirm = mode === 'load' ? !!selectedSlot?.hasValidSave : !isSaved
  const confirmLabel =
    mode === 'save'
      ? isSaved
        ? '已保存'
        : selectedSlot?.hasValidSave
          ? `覆盖存档位 ${selectedIndex + 1}`
          : `保存至存档位 ${selectedIndex + 1}`
      : selectedSlot?.hasValidSave
        ? `读存档 ${selectedIndex + 1}`
        : '确认载入'

  async function handleConfirm() {
    if (busy || !canConfirm) return
    setBusy(true)
    setError(null)
    try {
      if (mode === 'save') {
        const result = await saveGame(selectedIndex)
        setSavedIndex(selectedIndex)
        setSlots((prev) => prev.map((s, i) => (i === selectedIndex ? result : s)))
        onDone?.(`已保存至存档位 ${selectedIndex + 1}`)
        return
      }
      const result = await loadGame(selectedIndex)
      onDone?.(`已读档 ${selectedIndex + 1} · ${result.progressLabel}`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  function selectSlot(index: number) {
    setSelectedIndex(index)
    if (savedIndex !== null && savedIndex !== index) {
      setSavedIndex(null)
    }
  }

  return (
    <motion.div
      className="absolute inset-0 z-[105] flex min-h-0 flex-col bg-gradient-to-b from-[#FFFBFB] to-[#FFF5F7]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-rose-100 px-4 pb-3 pt-[max(10px,env(safe-area-inset-top,0px))]">
        <Pressable onClick={onClose} className="flex h-9 w-9 items-center justify-center text-stone-600" aria-label="关闭">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <div className="min-w-0 flex-1">
          <h2 className="sm-serif text-[18px] font-semibold text-[#2D2422]">{title}</h2>
          <p className="text-[12px] text-stone-500">
            {mode === 'save' ? '点选存档位保存当前进度' : '点选存档位读取进度'}
          </p>
        </div>
      </div>

      <div className="sm-tab-scroll min-h-0 flex-1">
        <div className="sm-tab-scroll-inner space-y-3">
          {loading ? (
            <p className="py-12 text-center text-[14px] text-stone-500">读取存档中…</p>
          ) : (
            <>
              {mode === 'save' ? <CurrentProgressStrip slot={currentSlot} /> : null}

              <SaveArchivePager
                page={page}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(0, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              />

              <div className="grid grid-cols-3 grid-rows-2 gap-2">
                {pageSlots.map((slot) => (
                  <SaveSlotCell
                    key={slot.slotIndex}
                    slot={slot}
                    selected={selectedIndex === slot.slotIndex}
                    onSelect={() => selectSlot(slot.slotIndex)}
                  />
                ))}
              </div>

              <SelectedSlotDetail slot={selectedSlot} />
            </>
          )}

          {error ? <p className="text-center text-[13px] text-rose-600">{error}</p> : null}
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-rose-100 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom,0px))]">
        <Pressable
          onClick={() => void handleConfirm()}
          disabled={busy || !canConfirm}
          className="sm-btn-primary w-full text-center text-[15px] disabled:opacity-40"
        >
          {busy ? '处理中…' : confirmLabel}
        </Pressable>
        <Pressable onClick={onClose} className="sm-btn-ghost w-full text-center text-[15px]">
          返回
        </Pressable>
      </div>
    </motion.div>
  )
}
