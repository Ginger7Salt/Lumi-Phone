import { ChevronLeft, ChevronRight, Download, Loader2, Pencil, RefreshCw, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchList as ReactTouchList,
} from 'react'
import { createPortal } from 'react-dom'

import { MomentsSerifNumericText } from './ArchiveTimelineDateColumn'
import { saveMomentImageToAlbum } from './saveMomentImageToAlbum'

type MomentImageViewerProps = {
  open: boolean
  images: string[]
  initialIndex?: number
  allowSave?: boolean
  onClose: () => void
  /** 与 images 对齐的生图提示词（可缺省或缺项） */
  prompts?: string[]
  /** 大图底部显示「重新生成 / 编辑提示词」 */
  allowImageRegen?: boolean
  /**
   * 与 images 对齐；为 false 的张不显示重新生成/编辑提示词（如用户本地上传图）。
   * 缺省则整组随 allowImageRegen。
   */
  regenEnabledByIndex?: boolean[]
  /** 操作区 / 编辑面板主题：朋友圈微信绿 vs 微博粉金 */
  regenTheme?: 'moments' | 'pulse'
  regenerating?: boolean
  onRegenerate?: (index: number, prompt: string) => void | Promise<void>
  onSavePrompt?: (index: number, prompt: string) => void | Promise<void>
}

const MIN_SCALE = 1
const MAX_SCALE = 4
const SLIDE_TRANSITION = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)'

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

function rubberBandOffset(delta: number, index: number, count: number): number {
  if (count <= 1) return delta * 0.35
  if (index <= 0 && delta > 0) return delta * 0.35
  if (index >= count - 1 && delta < 0) return delta * 0.35
  return delta
}

export function MomentImageViewer({
  open,
  images,
  initialIndex = 0,
  allowSave = false,
  onClose,
  prompts,
  allowImageRegen = false,
  regenEnabledByIndex,
  regenTheme = 'moments',
  regenerating = false,
  onRegenerate,
  onSavePrompt,
}: MomentImageViewerProps) {
  const [index, setIndex] = useState(initialIndex)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [slideWidth, setSlideWidth] = useState(0)
  const [swipeOffsetX, setSwipeOffsetX] = useState(0)
  const [slideTransition, setSlideTransition] = useState(SLIDE_TRANSITION)
  const [promptEditorOpen, setPromptEditorOpen] = useState(false)
  const [promptDraft, setPromptDraft] = useState('')
  const [actionError, setActionError] = useState('')
  const [localBusy, setLocalBusy] = useState(false)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const swipeStartXRef = useRef<number | null>(null)
  const isDraggingSlideRef = useRef(false)
  const pendingIndexRef = useRef<number | null>(null)
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null)
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const count = images.length
  const currentSrc = images[index] ?? ''
  const currentPrompt = (prompts?.[index] ?? '').trim()
  const busy = regenerating || localBusy
  const regenEnabledForCurrent =
    !regenEnabledByIndex || regenEnabledByIndex[index] !== false
  const showRegenActions =
    allowImageRegen && regenEnabledForCurrent && Boolean(onRegenerate || onSavePrompt)
  const isPulseTheme = regenTheme === 'pulse'
  const primaryAccent = isPulseTheme ? '#E5989B' : '#07C160'
  const accentSoft = isPulseTheme ? 'rgba(229,152,155,0.22)' : 'rgba(7,193,96,0.18)'

  const resetTransform = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const resetSlideOffset = useCallback((animated = true) => {
    pendingIndexRef.current = null
    setSlideTransition(animated ? SLIDE_TRANSITION : 'none')
    setSwipeOffsetX(0)
  }, [])

  const finalizePendingSlide = useCallback(() => {
    const nextIndex = pendingIndexRef.current
    if (nextIndex == null) return
    pendingIndexRef.current = null
    setSlideTransition('none')
    setIndex(nextIndex)
    resetTransform()
    setSwipeOffsetX(0)
    requestAnimationFrame(() => setSlideTransition(SLIDE_TRANSITION))
  }, [resetTransform])

  useEffect(() => {
    if (!open) return
    const safeIndex = Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1))
    setIndex(safeIndex)
    resetTransform()
    resetSlideOffset(false)
    pendingIndexRef.current = null
    setPromptEditorOpen(false)
    setActionError('')
  }, [open, initialIndex, images.length, resetSlideOffset, resetTransform])

  useEffect(() => {
    if (!promptEditorOpen) return
    setPromptDraft(prompts?.[index] ?? '')
  }, [promptEditorOpen, index, prompts])

  useEffect(() => {
    if (regenEnabledForCurrent) return
    setPromptEditorOpen(false)
    setActionError('')
  }, [regenEnabledForCurrent])

  useEffect(() => {
    if (!open || !viewportRef.current) return
    const el = viewportRef.current
    const syncWidth = () => setSlideWidth(el.clientWidth)
    syncWidth()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncWidth) : null
    ro?.observe(el)
    window.addEventListener('resize', syncWidth)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', syncWidth)
    }
  }, [open])

  const animateSlideTo = useCallback(
    (nextIndex: number, targetOffsetX: number) => {
      if (!slideWidth) {
        setIndex(nextIndex)
        resetTransform()
        resetSlideOffset(false)
        return
      }

      pendingIndexRef.current = nextIndex
      setSlideTransition(SLIDE_TRANSITION)
      setSwipeOffsetX(targetOffsetX)
    },
    [resetSlideOffset, resetTransform, slideWidth],
  )

  const goPrev = useCallback(() => {
    if (index <= 0 || !slideWidth || busy) return
    setPromptEditorOpen(false)
    animateSlideTo(index - 1, slideWidth)
  }, [animateSlideTo, busy, index, slideWidth])

  const goNext = useCallback(() => {
    if (index >= count - 1 || !slideWidth || busy) return
    setPromptEditorOpen(false)
    animateSlideTo(index + 1, -slideWidth)
  }, [animateSlideTo, busy, count, index, slideWidth])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (promptEditorOpen) {
          setPromptEditorOpen(false)
          return
        }
        onClose()
      }
      if (busy || promptEditorOpen) return
      if (e.key === 'ArrowLeft' && scale <= 1) goPrev()
      if (e.key === 'ArrowRight' && scale <= 1) goNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, goNext, goPrev, onClose, open, promptEditorOpen, scale])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const finishSwipe = useCallback(
    (deltaX: number) => {
      isDraggingSlideRef.current = false
      swipeStartXRef.current = null

      const threshold = Math.max(48, slideWidth * 0.18)
      if (deltaX > threshold && index > 0) {
        animateSlideTo(index - 1, slideWidth)
        return
      }
      if (deltaX < -threshold && index < count - 1) {
        animateSlideTo(index + 1, -slideWidth)
        return
      }
      resetSlideOffset(true)
    },
    [animateSlideTo, count, index, resetSlideOffset, slideWidth],
  )

  const handleSave = async () => {
    if (!allowSave || !currentSrc || saving) return
    setSaving(true)
    try {
      const result = await saveMomentImageToAlbum(currentSrc, 'wechat-moment')
      if (!result.ok && result.message) window.alert(result.message)
    } finally {
      setSaving(false)
    }
  }

  const openPromptEditor = () => {
    setActionError('')
    setPromptDraft(currentPrompt)
    setPromptEditorOpen(true)
  }

  const runRegenerate = async (prompt: string) => {
    const p = prompt.trim()
    if (!p) {
      setActionError('请先填写生图提示词')
      openPromptEditor()
      return
    }
    if (!onRegenerate || busy) return
    setActionError('')
    setLocalBusy(true)
    try {
      await onRegenerate(index, p)
      setPromptEditorOpen(false)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '重新生成失败')
    } finally {
      setLocalBusy(false)
    }
  }

  const savePromptOnly = async () => {
    const p = promptDraft.trim()
    if (!p) {
      setActionError('提示词不能为空')
      return
    }
    if (!onSavePrompt) {
      setPromptEditorOpen(false)
      return
    }
    setLocalBusy(true)
    setActionError('')
    try {
      await onSavePrompt(index, p)
      setPromptEditorOpen(false)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setLocalBusy(false)
    }
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.15 : 0.15
    setScale((s) => {
      const next = clampScale(s + delta)
      if (next <= 1) setOffset({ x: 0, y: 0 })
      return next
    })
  }

  const onDoubleClick = () => {
    if (scale > 1) {
      resetTransform()
      return
    }
    setScale(2)
  }

  const touchDistance = (touches: ReactTouchList) => {
    if (touches.length < 2) return 0
    const a = touches[0]!
    const b = touches[1]!
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  const beginSlideDrag = (clientX: number) => {
    if (scale > 1 || count <= 1 || busy || promptEditorOpen) return
    pendingIndexRef.current = null
    isDraggingSlideRef.current = true
    swipeStartXRef.current = clientX
    setSlideTransition('none')
  }

  const moveSlideDrag = (clientX: number) => {
    if (!isDraggingSlideRef.current || swipeStartXRef.current == null || scale > 1) return
    const delta = clientX - swipeStartXRef.current
    setSwipeOffsetX(rubberBandOffset(delta, index, count))
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { distance: touchDistance(e.touches), scale }
      panRef.current = null
      isDraggingSlideRef.current = false
      swipeStartXRef.current = null
      return
    }
    if (e.touches.length === 1 && scale > 1) {
      panRef.current = {
        x: e.touches[0]!.clientX,
        y: e.touches[0]!.clientY,
        ox: offset.x,
        oy: offset.y,
      }
      return
    }
    if (e.touches.length === 1 && scale <= 1) {
      beginSlideDrag(e.touches[0]!.clientX)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const distance = touchDistance(e.touches)
      if (distance <= 0) return
      const next = clampScale(pinchRef.current.scale * (distance / pinchRef.current.distance))
      setScale(next)
      if (next <= 1) setOffset({ x: 0, y: 0 })
      return
    }
    if (e.touches.length === 1 && panRef.current && scale > 1) {
      const t = e.touches[0]!
      setOffset({
        x: panRef.current.ox + t.clientX - panRef.current.x,
        y: panRef.current.oy + t.clientY - panRef.current.y,
      })
      return
    }
    if (e.touches.length === 1 && isDraggingSlideRef.current) {
      moveSlideDrag(e.touches[0]!.clientX)
    }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (pinchRef.current && e.touches.length < 2) pinchRef.current = null
    if (panRef.current && e.touches.length === 0) panRef.current = null

    if (isDraggingSlideRef.current && e.changedTouches.length === 1) {
      const delta = e.changedTouches[0]!.clientX - (swipeStartXRef.current ?? 0)
      finishSwipe(delta)
      return
    }
    swipeStartXRef.current = null
    isDraggingSlideRef.current = false
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    if (scale > 1 || count <= 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    beginSlideDrag(e.clientX)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    if (!isDraggingSlideRef.current) return
    moveSlideDrag(e.clientX)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    if (!isDraggingSlideRef.current || swipeStartXRef.current == null) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    finishSwipe(e.clientX - swipeStartXRef.current)
  }

  const onPointerCancel = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    if (!isDraggingSlideRef.current) return
    resetSlideOffset(true)
    isDraggingSlideRef.current = false
    swipeStartXRef.current = null
  }

  const onTrackTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== trackRef.current || e.propertyName !== 'transform') return
    if (pendingIndexRef.current != null) finalizePendingSlide()
  }

  const trackTranslateX = slideWidth > 0 ? -index * slideWidth + swipeOffsetX : swipeOffsetX

  if (!open || !count) return null

  const overlay = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[600] flex flex-col bg-black/96"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (promptEditorOpen) {
              setPromptEditorOpen(false)
              return
            }
            onClose()
          }}
        >
          <div
            className="flex shrink-0 items-center justify-between px-3 pb-2"
            style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="关闭"
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>
            {count > 1 ? (
              <span className="text-[13px] text-white/75">
                <MomentsSerifNumericText text={`${index + 1} / ${count}`} />
              </span>
            ) : (
              <span className="text-[13px] text-white/50">图片</span>
            )}
            {allowSave ? (
              <button
                type="button"
                aria-label="保存到相册"
                disabled={saving || busy}
                onClick={() => void handleSave()}
                className="flex size-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                <Download className="size-5" strokeWidth={1.75} />
              </button>
            ) : (
              <div className="size-10" />
            )}
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-2"
            onClick={(e) => e.stopPropagation()}
          >
            {index > 0 ? (
              <button
                type="button"
                aria-label="上一张"
                disabled={busy}
                onClick={goPrev}
                className="absolute left-1 z-10 flex size-10 items-center justify-center rounded-full bg-black/35 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/50 disabled:opacity-40 sm:left-3"
              >
                <ChevronLeft className="size-6" strokeWidth={1.75} />
              </button>
            ) : null}

            <div
              ref={viewportRef}
              className="h-full w-full max-w-full touch-none select-none overflow-hidden"
              style={{ touchAction: 'none' }}
              onWheel={onWheel}
              onDoubleClick={onDoubleClick}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            >
              <div
                ref={trackRef}
                className="flex h-full will-change-transform"
                style={{
                  width: slideWidth > 0 ? slideWidth * count : `${count * 100}%`,
                  transform: `translate3d(${trackTranslateX}px, 0, 0)`,
                  transition: slideTransition,
                }}
                onTransitionEnd={onTrackTransitionEnd}
              >
                {images.map((src, imageIndex) => {
                  const isActive = imageIndex === index
                  return (
                    <div
                      key={`${src.slice(0, 48)}-${imageIndex}`}
                      className="flex h-full shrink-0 items-center justify-center px-1"
                      style={{ width: slideWidth > 0 ? slideWidth : `${100 / count}%` }}
                    >
                      <img
                        src={src}
                        alt=""
                        className="max-h-[min(72vh,680px)] max-w-full object-contain"
                        style={{
                          transform: isActive
                            ? `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`
                            : undefined,
                          opacity: isActive && busy ? 0.55 : 1,
                        }}
                        draggable={false}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {index < count - 1 ? (
              <button
                type="button"
                aria-label="下一张"
                disabled={busy}
                onClick={goNext}
                className="absolute right-1 z-10 flex size-10 items-center justify-center rounded-full bg-black/35 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/50 disabled:opacity-40 sm:right-3"
              >
                <ChevronRight className="size-6" strokeWidth={1.75} />
              </button>
            ) : null}

            {busy ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                <div className="flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-[13px] text-white/90 backdrop-blur-md">
                  <Loader2 className="size-4 animate-spin" strokeWidth={1.7} />
                  正在重新生成…
                </div>
              </div>
            ) : null}
          </div>

          <div
            className="shrink-0 px-4 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            {showRegenActions ? (
              <div className="mx-auto flex w-full max-w-md flex-col gap-2">
                {actionError && !promptEditorOpen ? (
                  <p className="text-center text-[11px] text-[#F5A9A9]">{actionError}</p>
                ) : null}
                <div className="flex items-center justify-center gap-2">
                  {onRegenerate ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runRegenerate(currentPrompt)}
                      className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-white/95 backdrop-blur-md transition-colors disabled:opacity-45 ${
                        isPulseTheme
                          ? 'rounded-full bg-white/14 hover:bg-white/20'
                          : 'rounded-full bg-white/12 hover:bg-white/18'
                      }`}
                      style={
                        isPulseTheme
                          ? { boxShadow: `inset 0 0 0 1px ${accentSoft}` }
                          : undefined
                      }
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" strokeWidth={1.7} />
                      ) : (
                        <RefreshCw className="size-3.5" strokeWidth={1.7} />
                      )}
                      重新生成
                    </button>
                  ) : null}
                  {onSavePrompt || onRegenerate ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={openPromptEditor}
                      className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-white/95 backdrop-blur-md transition-colors disabled:opacity-45 ${
                        isPulseTheme
                          ? 'rounded-full bg-white/14 hover:bg-white/20'
                          : 'rounded-full bg-white/12 hover:bg-white/18'
                      }`}
                      style={
                        isPulseTheme
                          ? { boxShadow: `inset 0 0 0 1px ${accentSoft}` }
                          : undefined
                      }
                    >
                      <Pencil className="size-3.5" strokeWidth={1.7} />
                      编辑提示词
                    </button>
                  ) : null}
                </div>
                <p className="text-center text-[11px] text-white/40">双击放大 · 左右滑动切换</p>
              </div>
            ) : (
              <p className="text-center text-[11px] text-white/45">双击放大 · 左右滑动切换</p>
            )}
          </div>

          <AnimatePresence>
            {promptEditorOpen ? (
              <motion.div
                className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center px-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!busy) setPromptEditorOpen(false)
                }}
              >
                <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label="编辑生图提示词"
                  className={`relative w-full max-w-md p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] ${
                    isPulseTheme
                      ? 'rounded-[24px] bg-white/96 backdrop-blur-2xl'
                      : 'rounded-2xl bg-white/96 backdrop-blur-xl'
                  }`}
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-[#1C1C1E]">
                        {isPulseTheme ? '编辑配图提示词' : '生图提示词'}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-400">
                        {isPulseTheme
                          ? '占位描述已推成提示词；可改后再生成，不会影响其它配图。'
                          : '英文或中文均可；保存后可重新生成。'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label="关闭"
                      onClick={() => setPromptEditorOpen(false)}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-black/[0.04] disabled:opacity-40"
                    >
                      <X className="size-5" strokeWidth={1.5} />
                    </button>
                  </div>
                  {actionError ? (
                    <p className="mb-2 text-[12px]" style={{ color: isPulseTheme ? '#C97B7E' : '#C45C5C' }}>
                      {actionError}
                    </p>
                  ) : null}
                  <textarea
                    value={promptDraft}
                    disabled={busy}
                    onChange={(e) => setPromptDraft(e.target.value)}
                    rows={6}
                    placeholder={
                      isPulseTheme
                        ? '英文 tags 或中文画面描述…'
                        : '英文或中文均可；保存后可点重新生成'
                    }
                    className={`w-full resize-none px-3.5 py-3 text-[13px] leading-relaxed text-[#1C1C1E] outline-none placeholder:text-neutral-400 disabled:opacity-60 ${
                      isPulseTheme
                        ? 'rounded-2xl bg-[#F8F7F5] font-serif'
                        : 'rounded-xl bg-[#F5F5F4]'
                    }`}
                  />
                  <div className="mt-3.5 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPromptEditorOpen(false)}
                      className={`flex-1 py-2.5 text-[13px] text-neutral-600 disabled:opacity-50 ${
                        isPulseTheme ? 'rounded-full bg-[#F5F5F4]' : 'rounded-full bg-neutral-100'
                      }`}
                    >
                      取消
                    </button>
                    {onSavePrompt ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void savePromptOnly()}
                        className={`flex-1 py-2.5 text-[13px] font-medium disabled:opacity-50 ${
                          isPulseTheme
                            ? 'rounded-full bg-[#1C1C1E]/90 text-white'
                            : 'rounded-full bg-neutral-900/90 text-white'
                        }`}
                      >
                        仅保存
                      </button>
                    ) : null}
                    {onRegenerate ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runRegenerate(promptDraft)}
                        className={`flex-[1.2] py-2.5 text-[13px] font-medium text-white disabled:opacity-50 ${
                          isPulseTheme ? 'rounded-full' : 'rounded-full'
                        }`}
                        style={{ backgroundColor: primaryAccent }}
                      >
                        {busy ? '生成中…' : '保存并生成'}
                      </button>
                    ) : null}
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )

  return createPortal(overlay, document.body)
}
